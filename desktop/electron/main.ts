import { app, BrowserWindow, Menu } from 'electron';
import { AppController } from './app/appController.js';
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

// Conexão com o Supabase, sessão, banco local e sincronização vivem aqui no main.
const controller = new AppController();
registerAllIpcHandlers(controller);

app.whenReady().then(async () => {
  applyDockIcon();
  // safeStorage só funciona depois do "ready"; a janela abre na fase "loading"
  // e recebe o estado assim que a sessão salva for carregada.
  createMainWindow();
  try {
    await controller.init();
  } catch (err) {
    console.error('[app] falha ao iniciar:', err);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0 || !getMainWindow()) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Grava o banco local pendente antes de sair
let disposed = false;
app.on('before-quit', (event) => {
  if (disposed) return;
  event.preventDefault();
  disposed = true;
  controller
    .dispose()
    .catch((err) => console.error('[app] falha ao encerrar:', err))
    .finally(() => app.quit());
});
