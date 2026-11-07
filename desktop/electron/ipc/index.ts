import type { AppController } from '../app/appController';
import { registerAppIpc } from './app.ipc';
import { registerDataIpc } from './data.ipc';

export function registerAllIpcHandlers(controller: AppController) {
  registerAppIpc(controller);
  registerDataIpc(controller);
}
