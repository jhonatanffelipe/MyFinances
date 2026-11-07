import type { DbAdapter } from '../db/adapter';
import type { LocalStore } from '../db/localStore';
import { deterministicUuid } from '../domain/deterministicId';
import { roundMoney } from '../domain/money';
import type { CategoryRepository, CreditCardRepository, FamilyRepository, FixedExpenseRepository, MovementRepository } from '../domain/repositories';
import type { FixedExpenseRecurrence, TransactionType, Uuid } from '../domain/types';
import { AppError } from '../errors/AppError';

/**
 * Importação do banco da v1 (`db_myfinances.sqlite`, sql.js/expo-sqlite com ids INTEGER)
 * para a família ativa. A origem é aberta pelo app (sempre uma CÓPIA do arquivo) e chega
 * aqui como um DbAdapter; nada é escrito nela.
 *
 * Idempotência (importar de novo não duplica, nem um arquivo mais novo do mesmo banco):
 * - categorias e cartões são reaproveitados pelo nome (também permite importar o banco de
 *   outro membro na mesma família);
 * - fixos ganham id determinístico (família + identidade do banco v1 + id antigo);
 * - lançamentos usam `import_hash` (índice único por família);
 * - baixas usam `setPaid`, que já é idempotente.
 * O que a família excluiu depois de importar não volta.
 */

const RECURRENCES: FixedExpenseRecurrence[] = ['MONTHLY', 'BIMONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'ANNUAL'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}/;
const MOVEMENTS_PER_TRANSACTION = 500;

export type V1Table = 'categories' | 'credit_cards' | 'fixed_expenses' | 'fixed_expense_payments' | 'movements';

export interface V1Preview {
  categories: number;
  creditCards: number;
  fixedExpenses: number;
  payments: number;
  movements: number;
  /** Período dos lançamentos (YYYY-MM-DD). */
  period: { start: string; end: string } | null;
  /** Colunas que a v1 acrescentou com o tempo e faltam neste banco (usa os padrões da v1). */
  missingColumns: string[];
}

export interface V1ImportProblem {
  table: V1Table;
  oldId: number;
  reason: string;
}

export interface V1ImportReport {
  imported: Record<V1Table, number>;
  /** Já estavam na família (reimportação ou mesmo nome). */
  existing: Record<V1Table, number>;
  /** Registros ignorados ou importados sem um vínculo (categoria/cartão/fixo apagado na v1). */
  problems: V1ImportProblem[];
}

export interface V1ImportProgress {
  step: V1Table;
  done: number;
  total: number;
}

interface V1Data {
  identity: string;
  missingColumns: string[];
  categories: any[];
  cards: any[];
  fixed: any[];
  payments: any[];
  movements: any[];
}

const emptyCounts = (): Record<V1Table, number> => ({
  categories: 0,
  credit_cards: 0,
  fixed_expenses: 0,
  fixed_expense_payments: 0,
  movements: 0,
});

const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const date = (v: unknown) => (typeof v === 'string' && DATE_RE.test(v) ? v.slice(0, 10) : null);
const money = (v: unknown) => {
  const n = roundMoney(Number(v));
  return Number.isFinite(n) && n > 0 && n < 1e12 ? n : null;
};
const day = (v: unknown) => {
  const n = Math.trunc(Number(v));
  return n >= 1 && n <= 31 ? n : null;
};
const flag = (v: unknown) => v === null || v === undefined || Number(v) !== 0;
const sameName = (a: string, b: string) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }) === 0;

/** Lê o banco da v1 tolerando bancos antigos (sem as colunas do `ensureColumn`). */
async function readV1(source: DbAdapter): Promise<V1Data> {
  let tables: Set<string>;
  try {
    tables = new Set((await source.all<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table'")).map((t) => t.name));
  } catch {
    throw AppError.validation('Não foi possível abrir o arquivo. Escolha o db_myfinances.sqlite da v1.');
  }
  if (!tables.has('movements') || !tables.has('categories')) {
    throw AppError.validation('Este arquivo não é um banco do MyFinances v1 (faltam as tabelas de lançamentos e categorias).');
  }

  const missingColumns: string[] = [];
  const columns = async (table: string, wanted: string[]) => {
    if (!tables.has(table)) return new Set<string>();
    const have = new Set((await source.all<{ name: string }>(`PRAGMA table_info(${table})`)).map((c) => c.name));
    wanted.filter((c) => !have.has(c)).forEach((c) => missingColumns.push(`${table}.${c}`));
    return have;
  };
  const col = (have: Set<string>, name: string, fallback: string) => (have.has(name) ? name : `${fallback} AS ${name}`);

  const cat = await columns('categories', ['description', 'monthly_limit']);
  const mov = await columns('movements', ['credit_card_id', 'fixed_expense_id']);
  const fix = await columns('fixed_expenses', ['credit_card_id', 'recurrence', 'type']);

  const categories = await source.all(
    `SELECT id, name, type, color, icon, ${col(cat, 'description', 'NULL')}, ${col(cat, 'monthly_limit', 'NULL')} FROM categories ORDER BY id`,
  );
  const cards = tables.has('credit_cards') ? await source.all('SELECT id, description, color, due_day, active FROM credit_cards ORDER BY id') : [];
  const fixed = tables.has('fixed_expenses')
    ? await source.all(
        `SELECT id, description, amount, ${col(fix, 'type', "'EXPENSE'")}, category_id, ${col(fix, 'credit_card_id', 'NULL')},
                ${col(fix, 'recurrence', "'MONTHLY'")}, due_day, start_date, end_date, active, notes
         FROM fixed_expenses ORDER BY id`,
      )
    : [];
  const payments = tables.has('fixed_expense_payments')
    ? await source.all('SELECT id, fixed_expense_id, year_month FROM fixed_expense_payments ORDER BY id')
    : [];
  const movements = await source.all(
    `SELECT id, description, amount, date, type, category_id, ${col(mov, 'credit_card_id', 'NULL')}, ${col(mov, 'fixed_expense_id', 'NULL')}, notes
     FROM movements ORDER BY id`,
  );

  // Identidade do banco: as linhas mais antigas não mudam quando a v1 continua sendo usada,
  // então importar uma cópia mais nova do MESMO banco traz só o que é novo.
  const firstUser = tables.has('users') ? await source.first('SELECT name, created_at FROM users ORDER BY id LIMIT 1') : null;
  const firstCategory = await source.first('SELECT id, name, created_at FROM categories ORDER BY id LIMIT 1');
  const firstMovement = await source.first('SELECT id, description, date, created_at FROM movements ORDER BY id LIMIT 1');
  const identity = deterministicUuid(`myfinances-v1:${JSON.stringify([firstUser, firstCategory, firstMovement])}`);

  return { identity, missingColumns, categories, cards, fixed, payments, movements };
}

/** Prévia: o que o arquivo tem (sem gravar nada). */
export class PreviewV1Import {
  async execute(source: DbAdapter): Promise<V1Preview> {
    const v1 = await readV1(source);
    const dates = v1.movements.map((m) => date(m.date)).filter((d): d is string => !!d).sort();
    return {
      categories: v1.categories.length,
      creditCards: v1.cards.length,
      fixedExpenses: v1.fixed.length,
      payments: v1.payments.length,
      movements: v1.movements.length,
      period: dates.length ? { start: dates[0], end: dates[dates.length - 1] } : null,
      missingColumns: v1.missingColumns,
    };
  }
}

export class ImportV1Database {
  constructor(
    private readonly store: LocalStore,
    private readonly families: FamilyRepository,
    private readonly categories: CategoryRepository,
    private readonly cards: CreditCardRepository,
    private readonly fixed: FixedExpenseRepository,
    private readonly movements: MovementRepository,
  ) {}

  /**
   * @param memberId a quem atribuir o histórico (a v1 não registra quem lançou). Padrão: quem importa.
   */
  async execute(
    source: DbAdapter,
    options: { memberId?: Uuid | null; onProgress?: (p: V1ImportProgress) => void } = {},
  ): Promise<V1ImportReport> {
    const { userId, familyId } = this.store.session.current();
    const me = await this.families.findActiveMember(familyId, userId);
    if (!me || (me.role !== 'OWNER' && me.role !== 'ADMIN')) {
      throw new AppError('FORBIDDEN', 'Só quem administra a família pode importar o banco da v1');
    }
    const memberId = options.memberId || userId;
    if (!(await this.families.findActiveMember(familyId, memberId))) {
      throw new AppError('NOT_MEMBER', 'O histórico precisa ser de um membro ativo da família', { field: 'memberId' });
    }

    const v1 = await readV1(source);
    const report: V1ImportReport = { imported: emptyCounts(), existing: emptyCounts(), problems: [] };
    const problem = (table: V1Table, oldId: unknown, reason: string) => report.problems.push({ table, oldId: Number(oldId), reason });
    const progress = (step: V1Table, done: number, total: number) => options.onProgress?.({ step, done, total });
    const key = (table: string, oldId: unknown) => `v1:${familyId}:${v1.identity}:${table}:${oldId}`;

    // ---------------------------------------------------------------- categorias (pelo nome)
    const categoryMap = new Map<number, Uuid>();
    const currentCategories = (await this.categories.list({ perPage: 100_000 })).data;
    await this.store.write(async (ctx) => {
      for (const c of v1.categories) {
        const name = text(c.name).slice(0, 80);
        const type: TransactionType = c.type === 'INCOME' ? 'INCOME' : 'EXPENSE';
        if (!name) {
          problem('categories', c.id, 'Categoria sem nome: lançamentos dela ficam sem categoria');
          continue;
        }
        const found = currentCategories.find((x) => x.type === type && sameName(x.name, name));
        if (found) {
          categoryMap.set(Number(c.id), found.id);
          report.existing.categories++;
          continue;
        }
        const id = await this.categories.create(ctx, {
          name,
          description: text(c.description) || null,
          type,
          color: text(c.color) || '#94a3b8',
          icon: text(c.icon) || 'Tag',
          monthly_limit: c.monthly_limit === null || c.monthly_limit === undefined ? null : Math.max(0, roundMoney(Number(c.monthly_limit))) || null,
        });
        currentCategories.push({ id, name, type } as (typeof currentCategories)[number]);
        categoryMap.set(Number(c.id), id);
        report.imported.categories++;
      }
    });
    progress('categories', v1.categories.length, v1.categories.length);

    // ---------------------------------------------------------------- cartões (pelo nome)
    const cardMap = new Map<number, Uuid>();
    const currentCards = (await this.cards.list({ perPage: 100_000 })).data;
    await this.store.write(async (ctx) => {
      for (const c of v1.cards) {
        const description = text(c.description).slice(0, 80);
        if (!description) {
          problem('credit_cards', c.id, 'Cartão sem nome: lançamentos dele ficam sem cartão');
          continue;
        }
        const found = currentCards.find((x) => sameName(x.description, description));
        if (found) {
          cardMap.set(Number(c.id), found.id);
          report.existing.credit_cards++;
          continue;
        }
        const dueDay = day(c.due_day);
        if (!dueDay) problem('credit_cards', c.id, `Dia de vencimento inválido (${c.due_day}): usado dia 10`);
        const id = await this.cards.create(ctx, {
          description,
          color: text(c.color) || '#8b5cf6',
          due_day: dueDay ?? 10,
          active: flag(c.active),
          owner_id: null,
        });
        currentCards.push({ id, description } as (typeof currentCards)[number]);
        cardMap.set(Number(c.id), id);
        report.imported.credit_cards++;
      }
    });
    progress('credit_cards', v1.cards.length, v1.cards.length);

    const categoryOf = (table: V1Table, row: any) => {
      if (row.category_id === null || row.category_id === undefined) return null;
      const id = categoryMap.get(Number(row.category_id));
      if (!id) problem(table, row.id, 'Categoria apagada na v1: importado sem categoria');
      return id ?? null;
    };
    const cardOf = (table: V1Table, row: any) => {
      if (row.credit_card_id === null || row.credit_card_id === undefined) return null;
      const id = cardMap.get(Number(row.credit_card_id));
      if (!id) problem(table, row.id, 'Cartão apagado na v1: importado sem cartão');
      return id ?? null;
    };

    // ---------------------------------------------------------------- fixos (id determinístico)
    // Gravados direto pelo repositório: os lançamentos que a v1 gerou vêm junto e NÃO são regerados.
    const fixedMap = new Map<number, Uuid>();
    const fixedIds = v1.fixed.map((f) => deterministicUuid(key('fixed_expenses', f.id)));
    const existingFixed = await this.fixed.existingIds(fixedIds);
    await this.store.write(async (ctx) => {
      v1.fixed.forEach((f, i) => fixedMap.set(Number(f.id), fixedIds[i]));
      for (let i = 0; i < v1.fixed.length; i++) {
        const f = v1.fixed[i];
        const id = fixedIds[i];
        if (existingFixed.has(id)) {
          report.existing.fixed_expenses++;
          continue;
        }
        const description = text(f.description).slice(0, 200);
        const amount = money(f.amount);
        const start = date(f.start_date);
        if (!description || !amount || !start) {
          fixedMap.delete(Number(f.id));
          problem('fixed_expenses', f.id, 'Lançamento fixo sem descrição, valor ou início válidos: ignorado');
          continue;
        }
        const type: TransactionType = f.type === 'INCOME' ? 'INCOME' : 'EXPENSE';
        let end = date(f.end_date);
        if (end && end < start) {
          problem('fixed_expenses', f.id, 'Fim antes do início: importado sem data de fim');
          end = null;
        }
        await this.fixed.create(
          ctx,
          {
            member_id: memberId,
            description,
            amount,
            type,
            category_id: categoryOf('fixed_expenses', f),
            credit_card_id: type === 'INCOME' ? null : cardOf('fixed_expenses', f),
            recurrence: RECURRENCES.includes(f.recurrence) ? f.recurrence : 'MONTHLY',
            due_day: day(f.due_day) ?? 1,
            start_date: start,
            end_date: end,
            active: flag(f.active),
            notes: text(f.notes) || null,
          },
          id,
        );
        report.imported.fixed_expenses++;
      }
    });
    progress('fixed_expenses', v1.fixed.length, v1.fixed.length);

    // ---------------------------------------------------------------- baixas
    await this.store.write(async (ctx) => {
      for (const p of v1.payments) {
        const fixedId = fixedMap.get(Number(p.fixed_expense_id));
        const ym = typeof p.year_month === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(p.year_month) ? p.year_month : null;
        if (!fixedId || !ym) {
          problem('fixed_expense_payments', p.id, 'Baixa de lançamento fixo inexistente ou mês inválido: ignorada');
          continue;
        }
        if (existingFixed.has(fixedId)) {
          report.existing.fixed_expense_payments++;
          continue;
        }
        await this.fixed.setPaid(ctx, fixedId, ym, true);
        report.imported.fixed_expense_payments++;
      }
    });
    progress('fixed_expense_payments', v1.payments.length, v1.payments.length);

    // ---------------------------------------------------------------- lançamentos (import_hash)
    const hashOf = (m: any) => key('movements', m.id);
    const existingHashes = await this.movements.existingImportHashes(v1.movements.map(hashOf), { includeDeleted: true });
    const total = v1.movements.length;
    for (let i = 0; i < total; i += MOVEMENTS_PER_TRANSACTION) {
      const chunk = v1.movements.slice(i, i + MOVEMENTS_PER_TRANSACTION);
      await this.store.write(async (ctx) => {
        for (const m of chunk) {
          const hash = hashOf(m);
          if (existingHashes.has(hash)) {
            report.existing.movements++;
            continue;
          }
          const description = text(m.description).slice(0, 200);
          const amount = money(m.amount);
          const when = date(m.date);
          if (!description || !amount || !when || (m.type !== 'INCOME' && m.type !== 'EXPENSE')) {
            problem('movements', m.id, 'Lançamento sem descrição, valor, data ou tipo válidos: ignorado');
            continue;
          }
          let fixedId: Uuid | null = null;
          if (m.fixed_expense_id !== null && m.fixed_expense_id !== undefined) {
            fixedId = fixedMap.get(Number(m.fixed_expense_id)) ?? null;
            if (!fixedId) problem('movements', m.id, 'Lançamento fixo de origem apagado na v1: importado como avulso');
          }
          await this.movements.create(ctx, {
            member_id: memberId,
            to_member_id: null,
            description,
            amount,
            date: when,
            type: m.type,
            category_id: categoryOf('movements', m),
            credit_card_id: cardOf('movements', m),
            fixed_expense_id: fixedId,
            notes: text(m.notes) || null,
            import_hash: hash,
          });
          report.imported.movements++;
        }
      });
      progress('movements', Math.min(i + chunk.length, total), total);
    }
    return report;
  }
}

