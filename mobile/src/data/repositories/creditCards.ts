import { getDb, mutate } from '../db';
import { CreditCard } from '../types';

export type CreditCardInput = { description: string; color?: string; due_day: number; active?: number };

export async function listCreditCards(onlyActive = false) {
  return getDb().all<CreditCard>(
    `SELECT * FROM credit_cards ${onlyActive ? 'WHERE active = 1' : ''} ORDER BY description ASC`
  );
}

export async function getCreditCard(id: number) {
  return getDb().first<CreditCard>('SELECT * FROM credit_cards WHERE id = ?', [id]);
}

export async function createCreditCard(card: CreditCardInput) {
  return mutate(async (tx) => {
    const res = await tx.run('INSERT INTO credit_cards (description, color, due_day, active) VALUES (?, ?, ?, ?)', [
      card.description, card.color || '#8b5cf6', card.due_day, card.active ?? 1,
    ]);
    return res.lastInsertRowId;
  });
}

export async function updateCreditCard(id: number, card: CreditCardInput) {
  await mutate((tx) =>
    tx.run('UPDATE credit_cards SET description = ?, color = ?, due_day = ?, active = ? WHERE id = ?', [
      card.description, card.color || '#8b5cf6', card.due_day, card.active ?? 1, id,
    ])
  );
}

/** Remove o cartão mantendo os lançamentos (ficam sem cartão), como no desktop. */
export async function deleteCreditCard(id: number) {
  await mutate(async (tx) => {
    await tx.run('UPDATE movements SET credit_card_id = NULL WHERE credit_card_id = ?', [id]);
    await tx.run('UPDATE fixed_expenses SET credit_card_id = NULL WHERE credit_card_id = ?', [id]);
    await tx.run('DELETE FROM credit_cards WHERE id = ?', [id]);
  });
}
