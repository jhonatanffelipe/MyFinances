import { BrowserWindow, dialog, ipcMain } from 'electron';
import path from 'node:path';
import { IPC_CHANNELS } from '../../src/interfaces/IElectronBridge.js';
import { loadConfig, saveConfig } from '../config.js';
import { getCurrentDbFilePath, initDatabase } from '../database/index.js';
import { getMainWindow } from '../window.js';

export function registerDbIpc() {
  ipcMain.handle(IPC_CHANNELS.DB_GET_CONFIG, async () => {
    const config = loadConfig();
    const currentDbFilePath = getCurrentDbFilePath();
    return {
      dbPath: config.dbFolder || null,
      dbFile: currentDbFilePath ? path.basename(currentDbFilePath) : null,
    };
  });

  ipcMain.handle(IPC_CHANNELS.DB_SELECT_FOLDER, async () => {
    const win = getMainWindow() ?? BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
    if (!win) return { success: false, error: 'No main window' };

    const result = await dialog.showOpenDialog(win, {
      title: 'Escolha a pasta onde o banco de dados MyFinances será salvo',
      properties: ['openDirectory', 'createDirectory'],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, error: 'Seleção cancelada pelo usuário' };
    }

    const selectedFolder = result.filePaths[0];
    const initialized = await initDatabase(selectedFolder);

    if (initialized) {
      saveConfig({ dbFolder: selectedFolder });
      return { success: true, dbPath: selectedFolder };
    }
    return { success: false, error: 'Falha ao inicializar o banco de dados SQLite na pasta selecionada' };
  });
}
