import { app, BrowserWindow, Menu, nativeImage } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;

export function getAppIcon(): string | undefined {
  // .ico só é suportado no Windows; macOS e Linux usam o .png
  const exts = process.platform === 'win32' ? ['ico', 'png'] : ['png'];
  const baseDirs = [
    path.join(__dirname, '../public/icons'),
    path.join(process.cwd(), 'public/icons'),
    path.join(__dirname, '../dist/icons'),
  ];
  const candidates = baseDirs.flatMap((dir) => exts.map((ext) => path.join(dir, `icon.${ext}`)));

  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return undefined;
}

export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

/**
 * No macOS o ícone exibido no Dock e no Cmd+Tab é o do app (em dev, o Electron.app),
 * e não o da janela. Por isso definimos explicitamente o ícone do Dock.
 */
export function applyDockIcon() {
  if (process.platform !== 'darwin' || !app.dock) return;
  const iconPath = getAppIcon();
  if (!iconPath) return;
  try {
    const img = nativeImage.createFromPath(iconPath);
    if (!img.isEmpty()) {
      app.dock.setIcon(img);
    }
  } catch (e) {
    console.error('Error setting dock icon:', e);
  }
}

export function createMainWindow(): BrowserWindow {
  const iconPath = getAppIcon();

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    title: 'MyFinances - Controle Financeiro Pessoal',
    icon: iconPath,
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.removeMenu();
  mainWindow.maximize();
  mainWindow.show();

  if (iconPath) {
    try {
      const img = nativeImage.createFromPath(iconPath);
      if (!img.isEmpty()) {
        mainWindow.setIcon(img);
      }
    } catch (e) {
      console.error('Error setting window icon:', e);
    }
  }

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // F12 → abre/fecha DevTools
  mainWindow.webContents.on('before-input-event', (_event, input) => {
    if (input.type === 'keyDown' && input.key === 'F12') {
      if (mainWindow?.webContents.isDevToolsOpened()) {
        mainWindow.webContents.closeDevTools();
      } else {
        mainWindow?.webContents.openDevTools();
      }
    }
  });

  // Menu de contexto (botão direito) com Recortar / Copiar / Colar nos campos editáveis
  mainWindow.webContents.on('context-menu', (_event, params) => {
    const { isEditable, selectionText, editFlags } = params;
    const hasSelection = Boolean(selectionText && selectionText.trim());
    if (!isEditable && !hasSelection) return;

    const template: Electron.MenuItemConstructorOptions[] = isEditable
      ? [
          { role: 'undo', label: 'Desfazer', enabled: editFlags.canUndo },
          { role: 'redo', label: 'Refazer', enabled: editFlags.canRedo },
          { type: 'separator' },
          { role: 'cut', label: 'Recortar', enabled: editFlags.canCut },
          { role: 'copy', label: 'Copiar', enabled: editFlags.canCopy },
          { role: 'paste', label: 'Colar', enabled: editFlags.canPaste },
          { type: 'separator' },
          { role: 'selectAll', label: 'Selecionar tudo', enabled: editFlags.canSelectAll },
        ]
      : [{ role: 'copy', label: 'Copiar', enabled: editFlags.canCopy }];

    Menu.buildFromTemplate(template).popup({ window: mainWindow ?? undefined });
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  return mainWindow;
}
