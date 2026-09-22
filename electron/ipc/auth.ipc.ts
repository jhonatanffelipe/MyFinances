import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../src/interfaces/IElectronBridge.js';
import { getDatabase, persistDatabaseToDisk, queryObject } from '../database/index.js';
import { hashPassword, verifyPassword } from '../services/auth.service.js';

export function registerAuthIpc() {
  ipcMain.handle(IPC_CHANNELS.AUTH_STATUS, async () => {
    const db = getDatabase();
    if (!db) return { hasUser: false, userName: null, user: null };
    const row = queryObject(
      'SELECT id, name, email, role, phone, avatar, created_at, last_login FROM users ORDER BY id ASC LIMIT 1'
    );
    return {
      hasUser: !!row,
      userName: row?.name || null,
      user: row
        ? {
            id: row.id,
            name: row.name,
            email: row.email || '',
            role: row.role || '',
            phone: row.phone || '',
            avatar: row.avatar || '',
            created_at: row.created_at,
            last_login: row.last_login,
          }
        : null,
    };
  });

  ipcMain.handle(IPC_CHANNELS.AUTH_REGISTER, async (_event, name: string, password: string) => {
    const db = getDatabase();
    if (!db) return { success: false, error: 'Banco de dados não inicializado' };
    const trimmed = (name || '').trim();
    if (trimmed.length < 2) return { success: false, error: 'Informe um nome de usuário válido' };
    if (!password || password.length < 8) return { success: false, error: 'A senha deve ter no mínimo 8 caracteres' };

    const existing = queryObject('SELECT id FROM users WHERE name = ?', [trimmed]);
    if (existing) return { success: false, error: 'Já existe um usuário com esse nome neste banco' };

    const now = new Date().toISOString();
    db.run('INSERT INTO users (name, password_hash, last_login) VALUES (?, ?, ?)', [trimmed, hashPassword(password), now]);
    persistDatabaseToDisk();

    const created = queryObject(
      'SELECT id, name, email, role, phone, avatar, created_at, last_login FROM users WHERE name = ?',
      [trimmed]
    );
    return { success: true, user: created };
  });

  ipcMain.handle(IPC_CHANNELS.AUTH_LOGIN, async (_event, name: string, password: string) => {
    const db = getDatabase();
    if (!db) return { success: false, error: 'Banco de dados não inicializado' };
    const row = queryObject('SELECT * FROM users WHERE name = ?', [(name || '').trim()]);
    if (!row || !verifyPassword(password, row.password_hash)) {
      return { success: false, error: 'Usuário ou senha inválidos' };
    }

    const now = new Date().toISOString();
    db.run('UPDATE users SET last_login = ? WHERE id = ?', [now, row.id]);
    persistDatabaseToDisk();

    return {
      success: true,
      user: {
        id: row.id,
        name: row.name,
        email: row.email || '',
        role: row.role || '',
        phone: row.phone || '',
        avatar: row.avatar || '',
        created_at: row.created_at,
        last_login: now,
      },
    };
  });

  ipcMain.handle(
    IPC_CHANNELS.AUTH_UPDATE_PROFILE,
    async (
      _event,
      data: { id?: number; name: string; email?: string; role?: string; phone?: string; avatar?: string | null }
    ) => {
      const db = getDatabase();
      if (!db) return { success: false, error: 'Banco de dados não inicializado' };

      const trimmedName = (data.name || '').trim();
      if (trimmedName.length < 2) return { success: false, error: 'Informe um nome válido' };

      let targetId = data.id;
      if (!targetId) {
        const firstUser = queryObject('SELECT id FROM users ORDER BY id ASC LIMIT 1');
        targetId = firstUser?.id;
      }
      if (!targetId) return { success: false, error: 'Usuário não encontrado' };

      const existing = queryObject('SELECT id FROM users WHERE name = ? AND id != ?', [trimmedName, targetId]);
      if (existing) return { success: false, error: 'Já existe outro usuário com esse nome' };

      const currentUser = queryObject('SELECT * FROM users WHERE id = ?', [targetId]);
      const avatarToSet = data.avatar !== undefined ? data.avatar : (currentUser?.avatar || null);

      db.run(
        `UPDATE users
         SET name = ?, avatar = ?
         WHERE id = ?`,
        [trimmedName, avatarToSet, targetId]
      );
      persistDatabaseToDisk();

      const updated = queryObject(
        'SELECT id, name, email, role, phone, avatar, created_at, last_login FROM users WHERE id = ?',
        [targetId]
      );
      return { success: true, user: updated };
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.AUTH_CHANGE_PASSWORD,
    async (_event, data: { id: number; currentPassword: string; newPassword: string }) => {
      const db = getDatabase();
      if (!db) return { success: false, error: 'Banco de dados não inicializado' };

      const row = queryObject('SELECT * FROM users WHERE id = ?', [data.id]);
      if (!row) return { success: false, error: 'Usuário não encontrado' };

      if (!verifyPassword(data.currentPassword, row.password_hash)) {
        return { success: false, error: 'A senha atual informada está incorreta' };
      }

      if (!data.newPassword || data.newPassword.length < 8) {
        return { success: false, error: 'A nova senha deve ter no mínimo 8 caracteres' };
      }

      db.run('UPDATE users SET password_hash = ? WHERE id = ?', [hashPassword(data.newPassword), data.id]);
      persistDatabaseToDisk();

      return { success: true };
    }
  );
}
