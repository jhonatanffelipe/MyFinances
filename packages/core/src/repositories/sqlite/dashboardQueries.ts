import type { DashboardQueries, PeriodTotals } from '../../domain/repositories';
import type { FixedExpense } from '../../domain/types';
import { FIXED_SELECT, mapFixed } from './fixedExpenseRepository';
import { SqliteRepository } from './base';

/**
 * Consultas do dashboard na visão da FAMÍLIA. Transferências entre membros ficam
 * de fora: o dinheiro não saiu da família, então não é receita nem despesa.
 */
export class SqliteDashboardQueries extends SqliteRepository implements DashboardQueries {
  async balanceUntil(date: string): Promise<number> {
    const row = await this.db.first<{ balance: number }>(
      `SELECT COALESCE(SUM(CASE WHEN type = 'INCOME' THEN amount WHEN type = 'EXPENSE' THEN -amount ELSE 0 END), 0) AS balance
       FROM movements WHERE family_id = ? AND deleted_at IS NULL AND date <= ?`,
      [this.familyId(), date],
    );
    return row?.balance ?? 0;
  }

  async totals(start: string, end: string): Promise<PeriodTotals> {
    const row = await this.db.first<PeriodTotals>(
      `SELECT COALESCE(SUM(CASE WHEN type = 'INCOME'  THEN amount ELSE 0 END), 0) AS income,
              COALESCE(SUM(CASE WHEN type = 'EXPENSE' THEN amount ELSE 0 END), 0) AS expense
       FROM movements WHERE family_id = ? AND deleted_at IS NULL AND date >= ? AND date <= ?`,
      [this.familyId(), start, end],
    );
    return row ?? { income: 0, expense: 0 };
  }

  async fixedExpensesTotal(start: string, end: string): Promise<number> {
    const row = await this.db.first<{ total: number }>(
      `SELECT COALESCE(SUM(amount), 0) AS total FROM fixed_expenses
       WHERE family_id = ? AND deleted_at IS NULL AND active = 1 AND type = 'EXPENSE'
         AND start_date <= ? AND (end_date IS NULL OR end_date >= ?)`,
      [this.familyId(), end, start],
    );
    return row?.total ?? 0;
  }

  async expensesByCategory(start: string, end: string) {
    const rows = await this.db.all(
      `SELECT c.id, c.name AS label, c.color, SUM(m.amount) AS value
       FROM movements m JOIN categories c ON c.id = m.category_id
       WHERE m.family_id = ? AND m.deleted_at IS NULL AND m.type = 'EXPENSE' AND m.date >= ? AND m.date <= ?
       GROUP BY c.id, c.name, c.color ORDER BY value DESC`,
      [this.familyId(), start, end],
    );
    return rows.map((r) => ({ id: r.id, label: r.label, value: r.value, color: r.color || '#94a3b8' }));
  }

  async expensesByCard(start: string, end: string) {
    const rows = await this.db.all(
      `SELECT cc.id, cc.description AS label, cc.color, SUM(m.amount) AS value
       FROM movements m JOIN credit_cards cc ON cc.id = m.credit_card_id
       WHERE m.family_id = ? AND m.deleted_at IS NULL AND m.type = 'EXPENSE' AND m.date >= ? AND m.date <= ?
       GROUP BY cc.id, cc.description, cc.color ORDER BY value DESC`,
      [this.familyId(), start, end],
    );
    return rows.map((r) => ({ id: r.id, label: r.label, value: r.value, color: r.color || '#8b5cf6' }));
  }

  async upcomingFixedExpenses(yearMonth: string, start: string, end: string): Promise<FixedExpense[]> {
    const rows = await this.db.all(
      `${FIXED_SELECT}
       WHERE f.family_id = ? AND f.deleted_at IS NULL AND f.active = 1 AND f.type = 'EXPENSE'
         AND f.start_date <= ? AND (f.end_date IS NULL OR f.end_date >= ?)
       ORDER BY f.due_day ASC`,
      [yearMonth, this.familyId(), end, start],
    );
    return rows.map(mapFixed);
  }
}
