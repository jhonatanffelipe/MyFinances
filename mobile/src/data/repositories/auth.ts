import { scrypt } from 'scrypt-js';
import { getDb, mutate } from '../db';
import { AppUser } from '../types';

/**
 * Login local com os mesmos usuários do desktop. O desktop grava a senha como
 * "salt:hash" usando scrypt do Node (N=16384, r=8, p=1, 64 bytes), com o salt em
 * texto hexadecimal — aqui o cálculo é reproduzido com scrypt-js.
 */
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LEN = 64;

const encoder = new TextEncoder();

function toHex(bytes: Uint8Array) {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function randomHex(size: number) {
  const bytes = new Uint8Array(size);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    // Hermes (Android) não expõe crypto global: usa o módulo nativo do Expo
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('expo-crypto').getRandomValues(bytes);
  }
  return toHex(bytes);
}

async function derive(password: string, salt: string) {
  const key = await scrypt(encoder.encode(password), encoder.encode(salt), SCRYPT_N, SCRYPT_R, SCRYPT_P, KEY_LEN);
  return toHex(key);
}

export async function hashPassword(password: string) {
  const salt = randomHex(16);
  return `${salt}:${await derive(password, salt)}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [salt, hash] = (stored || '').split(':');
  if (!salt || !hash) return false;
  const derived = await derive(password, salt);
  if (derived.length !== hash.length) return false;
  let diff = 0;
  for (let i = 0; i < derived.length; i++) diff |= derived.charCodeAt(i) ^ hash.charCodeAt(i);
  return diff === 0;
}

const USER_FIELDS = 'id, name, email, role, phone, avatar, last_login, created_at';

export async function hasUsers() {
  const row = await getDb().first<{ count: number }>('SELECT COUNT(*) AS count FROM users');
  return (row?.count || 0) > 0;
}

export async function listUserNames() {
  return (await getDb().all<{ name: string }>('SELECT name FROM users ORDER BY id ASC')).map((r) => r.name);
}

export async function login(name: string, password: string): Promise<{ success: boolean; user?: AppUser; error?: string }> {
  const row = await getDb().first<any>('SELECT * FROM users WHERE name = ?', [(name || '').trim()]);
  if (!row || !(await verifyPassword(password, row.password_hash))) {
    return { success: false, error: 'Usuário ou senha inválidos' };
  }
  const user = await getDb().first<AppUser>(`SELECT ${USER_FIELDS} FROM users WHERE id = ?`, [row.id]);
  return { success: true, user: user || undefined };
}

export async function registerUser(name: string, password: string): Promise<{ success: boolean; user?: AppUser; error?: string }> {
  const trimmed = (name || '').trim();
  if (!trimmed || !password) return { success: false, error: 'Informe usuário e senha' };
  if (password.length < 4) return { success: false, error: 'A senha deve ter pelo menos 4 caracteres' };
  const existing = await getDb().first('SELECT id FROM users WHERE name = ?', [trimmed]);
  if (existing) return { success: false, error: 'Usuário já existe' };
  const hash = await hashPassword(password);
  const id = await mutate(async (tx) => {
    const res = await tx.run('INSERT INTO users (name, password_hash, last_login) VALUES (?, ?, ?)', [trimmed, hash, new Date().toISOString()]);
    return res.lastInsertRowId;
  });
  const user = await getDb().first<AppUser>(`SELECT ${USER_FIELDS} FROM users WHERE id = ?`, [id]);
  return { success: true, user: user || undefined };
}

export async function getUser(id: number) {
  return getDb().first<AppUser>(`SELECT ${USER_FIELDS} FROM users WHERE id = ?`, [id]);
}
