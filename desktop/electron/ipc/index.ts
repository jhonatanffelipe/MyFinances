import { registerAuthIpc } from './auth.ipc.js';
import { registerCategoriesIpc } from './categories.ipc.js';
import { registerCreditCardsIpc } from './creditCards.ipc.js';
import { registerDashboardIpc } from './dashboard.ipc.js';
import { registerDbIpc } from './db.ipc.js';
import { registerFixedExpensesIpc } from './fixedExpenses.ipc.js';
import { registerMovementsIpc } from './movements.ipc.js';

export function registerAllIpcHandlers() {
  registerDbIpc();
  registerAuthIpc();
  registerCategoriesIpc();
  registerCreditCardsIpc();
  registerMovementsIpc();
  registerFixedExpensesIpc();
  registerDashboardIpc();
}
