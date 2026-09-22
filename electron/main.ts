import { app, BrowserWindow, Menu } from 'electron';
import { loadConfig } from './config.js';
import { closeDatabase, initDatabase } from './database/index.js';
import { registerAllIpcHandlers } from './ipc/index.js';
import { createMainWindow, getMainWindow } from './window.js';

// No Windows, define o UserModelId para que o ícone apareça na barra de tarefas
if (process.platform === 'win32') {
  app.setAppUserModelId('com.myfinances.desktop');
}

// Remove a barra de menus padrão do Electron (File, Edit, View, Window, Help)
Menu.setApplicationMenu(null);

// Registra todos os canais IPC desacoplados
registerAllIpcHandlers();

app.whenReady().then(async () => {
  const initialConfig = loadConfig();
  if (initialConfig.dbFolder) {
    await initDatabase(initialConfig.dbFolder);
  }

  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0 || !getMainWindow()) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  closeDatabase();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
