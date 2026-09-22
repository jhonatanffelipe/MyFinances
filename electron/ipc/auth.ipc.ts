import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../src/interfaces/IElectronBridge.js';
import { getDatabase, persistDatabaseToDisk, queryObject } from '../database/index.js';
import { hashPassword, verifyPassword } from '../services/auth.service.js';

export function registerAuthIpc() {
  ipcMain.handle(IPC_CHANNELS.AUTH_STATUS, async () => {
    const db = getDatabase();
    if (!db) return { hasUser: false, userName: null };
    const row = queryObject('SELECT name FROM users ORDER BY id ASC LIMIT 1');
    return { hasUser: !!row, userName: row?.name || null };
  });

  ipcMain.handle(IPC_CHANNELS.AUTH_REGISTER, async (_event, name: string, password: string) => {
    const db = getDatabase();
    if (!db) return { success: false, error: 'Banco de dados não inicializado' };
    const trimmed = (name || '').trim();
    if (trimmed.length < 2) return { success: false, error: 'Informe um nome de usuário válido' };
    if (!password || password.length < 8) return { success: false, error: 'A senha deve ter no mínimo 8 caracteres' };

    const existing = queryObject('SELECT id FROM users WHERE name = ?', [trimmed]);
    if (existing) return { success: false, error: 'Já existe um usuário com esse nome neste banco' };

    db.run('INSERT INTO users (name, password_hash) VALUES (?, ?)', [trimmed, hashPassword(password)]);
    persistDatabaseToDisk();

    const created = queryObject('SELECT id, name, created_at FROM users WHERE name = ?', [trimmed]);
    return { success: true, user: created };
  });

  ipcMain.handle(IPC_CHANNELS.AUTH_LOGIN, async (_event, name: string, password: string) => {
    const db = getDatabase();
    if (!db) return { success: false, error: 'Banco de dados não inicializado' };
    const row = queryObject('SELECT * FROM users WHERE name = ?', [(name || '').trim()]);
    if (!row || !verifyPassword(password, row.password_hash)) {
      return { success: false, error: 'Usuário ou senha inválidos' };
    }
    return { success: true, user: { id: row.id, name: row.name, created_at: row.created_at } };
  });
}
