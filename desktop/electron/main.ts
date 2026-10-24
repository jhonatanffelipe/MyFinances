import { app, BrowserWindow, Menu } from 'electron';
import { loadConfig } from './config.js';
import { checkForExternalChanges, closeDatabase, initDatabase } from './database/index.js';
import { checkDbLockNow } from './database/lock.js';
import { onDbSyncEvent } from './database/syncEvents.js';
import { IPC_CHANNELS } from '../src/interfaces/IElectronBridge.js';
import { registerAllIpcHandlers } from './ipc/index.js';
import { applyDockIcon, createMainWindow, getMainWindow } from './window.js';

// Nome exibido pelo sistema (menu do app no macOS, diálogos etc.)
app.setName('MyFinances');

// No Windows, define o UserModelId para que o ícone apareça na barra de tarefas
if (process.platform === 'win32') {
  app.setAppUserModelId('com.myfinances.desktop');
}

// Remove a barra de menus padrão do Electron (File, Edit, View, Window, Help).
// No macOS os atalhos de edição (⌘C, ⌘V, ⌘X, ⌘A, ⌘Z) dependem do menu "Editar"
// da aplicação; sem ele não é possível colar nos campos. Por isso, no macOS
// mantemos um menu mínimo com os papéis nativos de app, edição e janela.
if (process.platform === 'darwin') {
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([{ role: 'appMenu' }, { role: 'editMenu' }, { role: 'windowMenu' }])
  );
} else {
  Menu.setApplicationMenu(null);
}

// Registra todos os canais IPC desacoplados
registerAllIpcHandlers();

// Repassa à interface os eventos de sincronização do banco (recarga, conflito, presença)
onDbSyncEvent((event) => {
  const win = getMainWindow();
  if (win && !win.isDestroyed()) {
    win.webContents.send(IPC_CHANNELS.DB_SYNC_EVENT, event);
  }
});

// Ao voltar para o app, confere se o OneDrive trouxe uma versão nova do banco
app.on('browser-window-focus', () => {
  checkDbLockNow();
  checkForExternalChanges();
});

app.whenReady().then(async () => {
  applyDockIcon();

  const initialConfig = loadConfig();
  const targetDb = initialConfig.dbFilePath || initialConfig.dbFolder;
  if (targetDb) {
    await initDatabase(targetDb);
  }

  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0 || !getMainWindow()) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // No macOS o app continua ativo sem janelas; o banco só é fechado ao sair
  if (process.platform !== 'darwin') {
    closeDatabase();
    app.quit();
  }
});

// Grava pendências e remove o arquivo de presença ao encerrar
app.on('will-quit', () => {
  closeDatabase();
});
