import type { SqlParam } from '../../db/adapter';
import type { DashboardMemberTotals, DashboardQueries, DashboardScope, PeriodTotals } from '../../domain/repositories';
import type { FixedExpense, Uuid } from '../../domain/types';
import { FIXED_SELECT, mapFixed } from './fixedExpenseRepository';
import { SqliteRepository } from './base';

/**
 * Consultas do dashboard, calculadas no SQLite local (funcionam offline e refletem na
 * hora o que acabou de ser lançado). Mesma regra de `005_dashboard.sql`:
 *
 * - Visão FAMÍLIA (`memberId` nulo): transferências entre membros ficam de fora — o
 *   dinheiro não saiu da família, então não é receita, despesa nem saldo.
 * - Visão de UM MEMBRO: lançamentos dele; transferências entram só no saldo (envia −,
 *   recebe +) e em transferIn/transferOut, nunca em receita/despesa ou nos gráficos.
 */
export class SqliteDashboardQueries extends SqliteRepository implements DashboardQueries {
  /** Filtro de receita/despesa da visão (transferências excluídas à parte). */
  private memberFilter(scope: DashboardScope, alias = 'm'): { sql: string; params: SqlParam[] } {
    return scope.memberId ? { sql: ` AND ${alias}.member_id = ?`, params: [scope.memberId] } : { sql: '', params: [] };
  }

  async memberName(memberId: Uuid): Promise<string | null> {
    const row = await this.db.first<{ name: string }>('SELECT name FROM members WHERE family_id = ? AND user_id = ?', [
      this.familyId(),
      memberId,
    ]);
    return row?.name ?? null;
  }

  async balanceUntil(date: string, scope: DashboardScope): Promise<number> {
    if (!scope.memberId) {
      const row = await this.db.first<{ balance: number }>(
        `SELECT COALESCE(SUM(CASE WHEN type = 'INCOME' THEN amount WHEN type = 'EXPENSE' THEN -amount ELSE 0 END), 0) AS balance
         FROM movements WHERE family_id = ? AND deleted_at IS NULL AND date <= ?`,
        [this.familyId(), date],
      );
      return row?.balance ?? 0;
    }
    const m = scope.memberId;
    const row = await this.db.first<{ balance: number }>(
      `SELECT COALESCE(SUM(CASE
                WHEN type = 'INCOME'  AND member_id = ? THEN amount
                WHEN type = 'EXPENSE' AND member_id = ? THEN -amount
                WHEN type = 'TRANSFER' AND member_id = ? THEN -amount
                WHEN type = 'TRANSFER' AND to_member_id = ? THEN amount
                ELSE 0 END), 0) AS balance
       FROM movements
       WHERE family_id = ? AND deleted_at IS NULL AND date <= ? AND (member_id = ? OR to_member_id = ?)`,
      [m, m, m, m, this.familyId(), date, m, m],
    );
    return row?.balance ?? 0;
  }

  async monthlyTotals(start: string, end: string, scope: DashboardScope): Promise<Array<PeriodTotals & { yearMonth: string }>> {
    const f = this.memberFilter(scope);
    return this.db.all(
      `SELECT substr(m.date, 1, 7) AS yearMonth,
              COALESCE(SUM(CASE WHEN m.type = 'INCOME'  THEN m.amount ELSE 0 END), 0) AS income,
              COALESCE(SUM(CASE WHEN m.type = 'EXPENSE' THEN m.amount ELSE 0 END), 0) AS expense
       FROM movements m
       WHERE m.family_id = ? AND m.deleted_at IS NULL AND m.type <> 'TRANSFER' AND m.date >= ? AND m.date <= ?${f.sql}
       GROUP BY substr(m.date, 1, 7)
       ORDER BY yearMonth`,
      [this.familyId(), start, end, ...f.params],
    );
  }

  async transfers(start: string, end: string, scope: DashboardScope): Promise<{ transferIn: number; transferOut: number }> {
    if (!scope.memberId) return { transferIn: 0, transferOut: 0 };
    const m = scope.memberId;
    const row = await this.db.first<{ transferIn: number; transferOut: number }>(
      `SELECT COALESCE(SUM(CASE WHEN to_member_id = ? THEN amount ELSE 0 END), 0) AS transferIn,
              COALESCE(SUM(CASE WHEN member_id = ? THEN amount ELSE 0 END), 0) AS transferOut
       FROM movements
       WHERE family_id = ? AND deleted_at IS NULL AND type = 'TRANSFER' AND date >= ? AND date <= ?
         AND (member_id = ? OR to_member_id = ?)`,
      [m, m, this.familyId(), start, end, m, m],
    );
    return row ?? { transferIn: 0, transferOut: 0 };
  }

  async activeFixedExpenses(start: string, end: string, scope: DashboardScope) {
    const f = this.memberFilter(scope, 'f');
    return this.db.all<{ amount: number; start_date: string; end_date: string | null }>(
      `SELECT f.amount, f.start_date, f.end_date FROM fixed_expenses f
       WHERE f.family_id = ? AND f.deleted_at IS NULL AND f.active = 1 AND f.type = 'EXPENSE'
         AND f.start_date <= ? AND (f.end_date IS NULL OR f.end_date >= ?)${f.sql}`,
      [this.familyId(), end, start, ...f.params],
    );
  }

  async expensesByCategory(start: string, end: string, scope: DashboardScope) {
    const f = this.memberFilter(scope);
    const rows = await this.db.all(
      `SELECT c.id, c.name AS label, c.color, SUM(m.amount) AS value
       FROM movements m JOIN categories c ON c.id = m.category_id
       WHERE m.family_id = ? AND m.deleted_at IS NULL AND m.type = 'EXPENSE' AND m.date >= ? AND m.date <= ?${f.sql}
       GROUP BY c.id, c.name, c.color ORDER BY value DESC`,
      [this.familyId(), start, end, ...f.params],
    );
    return rows.map((r) => ({ id: r.id, label: r.label, value: r.value, color: r.color || '#94a3b8' }));
  }

  async expensesByCard(start: string, end: string, scope: DashboardScope) {
    const f = this.memberFilter(scope);
    const rows = await this.db.all(
      `SELECT cc.id, cc.description AS label, cc.color, SUM(m.amount) AS value
       FROM movements m JOIN credit_cards cc ON cc.id = m.credit_card_id
       WHERE m.family_id = ? AND m.deleted_at IS NULL AND m.type = 'EXPENSE' AND m.date >= ? AND m.date <= ?${f.sql}
       GROUP BY cc.id, cc.description, cc.color ORDER BY value DESC`,
      [this.familyId(), start, end, ...f.params],
    );
    return rows.map((r) => ({ id: r.id, label: r.label, value: r.value, color: r.color || '#8b5cf6' }));
  }

  async byMember(start: string, end: string): Promise<DashboardMemberTotals[]> {
    return this.db.all<DashboardMemberTotals>(
      `SELECT m.member_id, mb.name,
              COALESCE(SUM(CASE WHEN m.type = 'INCOME'  THEN m.amount ELSE 0 END), 0) AS income,
              COALESCE(SUM(CASE WHEN m.type = 'EXPENSE' THEN m.amount ELSE 0 END), 0) AS expense
       FROM movements m
       LEFT JOIN members mb ON mb.family_id = m.family_id AND mb.user_id = m.member_id
       WHERE m.family_id = ? AND m.deleted_at IS NULL AND m.type <> 'TRANSFER' AND m.date >= ? AND m.date <= ?
       GROUP BY m.member_id, mb.name
       ORDER BY expense DESC`,
      [this.familyId(), start, end],
    );
  }

  async upcomingFixedExpenses(yearMonth: string, start: string, end: string, scope: DashboardScope): Promise<FixedExpense[]> {
    const f = this.memberFilter(scope, 'f');
    const rows = await this.db.all(
      `${FIXED_SELECT}
       WHERE f.family_id = ? AND f.deleted_at IS NULL AND f.active = 1 AND f.type = 'EXPENSE'
         AND f.start_date <= ? AND (f.end_date IS NULL OR f.end_date >= ?)${f.sql}
       ORDER BY f.due_day ASC`,
      [yearMonth, this.familyId(), end, start, ...f.params],
    );
    return rows.map(mapFixed);
  }
}
