import type { DbAdapter } from './db/adapter';
import { LocalStore } from './db/localStore';
import { migrateLocalDatabase } from './db/schema';
import { defaultIdGenerator, systemClock, type Clock, type IdGenerator, type SessionProvider } from './domain/ports';
import { SqliteCategoryRepository } from './repositories/sqlite/categoryRepository';
import { SqliteCreditCardRepository } from './repositories/sqlite/creditCardRepository';
import { SqliteDashboardQueries } from './repositories/sqlite/dashboardQueries';
import { SqliteFamilyRepository } from './repositories/sqlite/familyRepository';
import { SqliteFixedExpenseRepository } from './repositories/sqlite/fixedExpenseRepository';
import { SqliteMovementRepository } from './repositories/sqlite/movementRepository';
import * as categories from './use-cases/categories';
import * as cards from './use-cases/creditCards';
import { GetDashboard } from './use-cases/dashboard';
import * as fixed from './use-cases/fixedExpenses';
import { AnalyzeImport, ExecuteImport } from './use-cases/imports';
import * as movements from './use-cases/movements';
import { ImportV1Database, PreviewV1Import } from './use-cases/importV1';

export interface CoreDependencies {
  db: DbAdapter;
  session: SessionProvider;
  clock?: Clock;
  newId?: IdGenerator;
}

/**
 * Raiz de composição: monta repositórios e use cases sobre o banco local.
 * Cada app chama uma vez, depois de abrir o SQLite, e injeta o resultado.
 */
export async function createCore(deps: CoreDependencies) {
  await migrateLocalDatabase(deps.db);
  const clock = deps.clock ?? systemClock;
  const store = new LocalStore(deps.db, deps.session, clock, deps.newId ?? defaultIdGenerator);

  const repos = {
    families: new SqliteFamilyRepository(store),
    categories: new SqliteCategoryRepository(store),
    cards: new SqliteCreditCardRepository(store),
    movements: new SqliteMovementRepository(store),
    fixed: new SqliteFixedExpenseRepository(store),
    dashboard: new SqliteDashboardQueries(store),
  };

  const movementValidator = new movements.MovementValidator(store, repos.families, repos.categories, repos.cards);
  const fixedValidator = new fixed.FixedExpenseValidator(store, repos.families, repos.categories, repos.cards);

  return {
    store,
    repos,
    categories: {
      list: new categories.ListCategories(repos.categories),
      get: new categories.GetCategory(repos.categories),
      create: new categories.CreateCategory(store, repos.categories),
      update: new categories.UpdateCategory(store, repos.categories),
      remove: new categories.DeleteCategory(store, repos.categories),
      seedDefaults: new categories.SeedDefaultCategories(store, repos.categories),
    },
    creditCards: {
      list: new cards.ListCreditCards(repos.cards),
      get: new cards.GetCreditCard(repos.cards),
      create: new cards.CreateCreditCard(store, repos.cards),
      update: new cards.UpdateCreditCard(store, repos.cards),
      remove: new cards.DeleteCreditCard(store, repos.cards),
    },
    movements: {
      list: new movements.ListMovements(repos.movements),
      get: new movements.GetMovement(repos.movements),
      create: new movements.CreateMovement(store, repos.movements, movementValidator),
      update: new movements.UpdateMovement(store, repos.movements, movementValidator),
      remove: new movements.DeleteMovement(store, repos.movements),
      previewBulkDeleteCard: new movements.PreviewBulkDeleteCard(repos.movements, repos.cards),
      bulkDeleteCard: new movements.BulkDeleteCard(store, repos.movements, repos.cards),
      analyzeImport: new AnalyzeImport(repos.movements, repos.cards, clock),
      executeImport: new ExecuteImport(store, repos.movements, repos.categories, repos.cards),
    },
    fixedExpenses: {
      list: new fixed.ListFixedExpenses(repos.fixed),
      get: new fixed.GetFixedExpense(repos.fixed),
      create: new fixed.CreateFixedExpense(store, repos.fixed, repos.movements, fixedValidator),
      update: new fixed.UpdateFixedExpense(store, repos.fixed, repos.movements, fixedValidator),
      remove: new fixed.DeleteFixedExpense(store, repos.fixed, repos.movements),
      setPaid: new fixed.SetFixedExpensePaid(store, repos.fixed),
    },
    dashboard: {
      get: new GetDashboard(repos.dashboard),
    },
    /** Banco da v1 (db_myfinances.sqlite) → família ativa. */
    importV1: {
      preview: new PreviewV1Import(),
      execute: new ImportV1Database(store, repos.families, repos.categories, repos.cards, repos.fixed, repos.movements),
    },
  };
}

export type Core = Awaited<ReturnType<typeof createCore>>;
