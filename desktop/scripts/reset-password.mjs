#!/usr/bin/env node
/**
 * Redefine a senha de um usuário diretamente no arquivo do banco MyFinances.
 *
 * Uso:
 *   yarn reset-password <arquivo-ou-pasta-do-banco> <usuario> <nova-senha> [--force]
 *
 * - Gera o hash no mesmo formato do app ("salt:hash", scrypt do Node, 64 bytes).
 * - Faz backup do arquivo ao lado do banco antes de gravar.
 * - Recusa gravar se o arquivo de presença (.lock) indicar o banco aberto em algum
 *   dispositivo nos últimos 3 minutos (use --force para ignorar).
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const initSqlJs = require('sql.js');

const DB_FILE_NAME = 'db_myfinances.sqlite';
const LOCK_STALE_MS = 3 * 60 * 1000;

function fail(message) {
  console.error(`Erro: ${message}`);
  process.exit(1);
}

function resolveDbFile(target) {
  if (!fs.existsSync(target)) fail(`caminho não encontrado: ${target}`);
  if (fs.statSync(target).isFile()) return target;
  const file = path.join(target, DB_FILE_NAME);
  if (!fs.existsSync(file)) fail(`não há ${DB_FILE_NAME} em ${target}`);
  return file;
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return derived === hash;
}

function assertNotOpenElsewhere(dbFile, force) {
  const lockFile = `${dbFile}.lock`;
  if (force || !fs.existsSync(lockFile)) return;
  try {
    const lock = JSON.parse(fs.readFileSync(lockFile, 'utf-8'));
    const updated = Date.parse(lock.updatedAt);
    if (Number.isFinite(updated) && Date.now() - updated < LOCK_STALE_MS) {
      fail(
        `o banco está aberto em "${lock.deviceName || lock.deviceId}" (${lock.app || 'app'}). ` +
          'Feche o MyFinances nos outros dispositivos e tente de novo, ou use --force.'
      );
    }
  } catch {
    // .lock vazio ou parcial (sincronizando): tratado como ausente, igual ao app
  }
}

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const [target, userName, newPassword] = args.filter((a) => a !== '--force');
  if (!target || !userName || !newPassword) {
    fail('uso: yarn reset-password <arquivo-ou-pasta-do-banco> <usuario> <nova-senha> [--force]');
  }
  if (newPassword.length < 4) fail('a senha deve ter pelo menos 4 caracteres');

  const dbFile = resolveDbFile(path.resolve(target));
  assertNotOpenElsewhere(dbFile, force);

  const SQL = await initSqlJs();
  const original = fs.readFileSync(dbFile);
  const db = new SQL.Database(original);

  const found = db.exec('SELECT id, name FROM users WHERE name = ?', [userName]);
  if (!found.length) {
    const names = db.exec('SELECT name FROM users ORDER BY id')[0]?.values.map((r) => r[0]) ?? [];
    fail(`usuário "${userName}" não encontrado. Usuários no banco: ${names.join(', ') || '(nenhum)'}`);
  }
  const [userId] = found[0].values[0];

  db.run('UPDATE users SET password_hash = ? WHERE id = ?', [hashPassword(newPassword), userId]);
  const stored = db.exec('SELECT password_hash FROM users WHERE id = ?', [userId])[0].values[0][0];
  if (!verifyPassword(newPassword, stored)) fail('falha ao conferir o novo hash; nada foi gravado');

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
  const ext = path.extname(dbFile);
  const backupFile = path.join(path.dirname(dbFile), `${path.basename(dbFile, ext)}.backup-${stamp}${ext}`);
  fs.copyFileSync(dbFile, backupFile);

  // Grava num temporário e renomeia, para o OneDrive nunca ver um arquivo pela metade
  const tmpFile = `${dbFile}.tmp-${process.pid}`;
  fs.writeFileSync(tmpFile, Buffer.from(db.export()));
  fs.renameSync(tmpFile, dbFile);
  db.close();

  console.log(`Senha do usuário "${userName}" (id ${userId}) redefinida.`);
  console.log(`Banco: ${dbFile}`);
  console.log(`Backup: ${backupFile}`);
}

main().catch((err) => fail(err?.message || String(err)));
