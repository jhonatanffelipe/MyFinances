import { BrowserWindow, dialog, ipcMain } from 'electron';
import path from 'node:path';
import { IPC_CHANNELS } from '../../src/interfaces/IElectronBridge.js';
import { loadConfig, saveConfig } from '../config.js';
import { getDatabase, getCurrentDbFilePath, initDatabase } from '../database/index.js';
import { getMainWindow } from '../window.js';

export function registerDbIpc() {
  ipcMain.handle(IPC_CHANNELS.DB_GET_CONFIG, async () => {
    const config = loadConfig();
    const currentDbFilePath = getCurrentDbFilePath();
    const db = getDatabase();

    // Se o banco não estiver inicializado ou arquivo não existir, retorna nulo para forçar seleção de banco
    if (!db || !currentDbFilePath) {
      return {
        dbPath: null,
        dbFile: null,
      };
    }

    return {
      dbPath: config.dbFolder || path.dirname(currentDbFilePath),
      dbFile: path.basename(currentDbFilePath),
    };
  });

  ipcMain.handle(IPC_CHANNELS.DB_SELECT_FOLDER, async () => {
    const win = getMainWindow() ?? BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
    if (!win) return { success: false, error: 'Janela principal não encontrada' };

    const result = await dialog.showOpenDialog(win, {
      title: 'Escolha a pasta onde o banco de dados MyFinances será salvo ou criado',
      properties: ['openDirectory', 'createDirectory'],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, error: 'Seleção cancelada pelo usuário' };
    }

    const selectedFolder = result.filePaths[0];
    const initialized = await initDatabase(selectedFolder);

    if (initialized) {
      saveConfig({ dbFolder: selectedFolder });
      const currentDb = getCurrentDbFilePath();
      return {
        success: true,
        dbPath: selectedFolder,
        dbFile: currentDb ? path.basename(currentDb) : null,
      };
    }
    return { success: false, error: 'Falha ao inicializar o banco de dados SQLite na pasta selecionada' };
  });

  ipcMain.handle(IPC_CHANNELS.DB_SELECT_FILE, async () => {
    const win = getMainWindow() ?? BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
    if (!win) return { success: false, error: 'Janela principal não encontrada' };

    const result = await dialog.showOpenDialog(win, {
      title: 'Selecione um arquivo de banco de dados SQLite existente',
      properties: ['openFile'],
      filters: [
        { name: 'Banco de Dados SQLite', extensions: ['sqlite', 'sqlite3', 'db'] },
        { name: 'Todos os arquivos', extensions: ['*'] },
      ],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, error: 'Seleção cancelada pelo usuário' };
    }

    const selectedFile = result.filePaths[0];
    const initialized = await initDatabase(selectedFile);

    if (initialized) {
      const folderPath = path.dirname(selectedFile);
      saveConfig({ dbFolder: folderPath, dbFilePath: selectedFile });
      return {
        success: true,
        dbPath: folderPath,
        dbFile: path.basename(selectedFile),
      };
    }
    return { success: false, error: 'Falha ao abrir o banco de dados SQLite selecionado' };
  });
}
