import { DbAdapter } from './adapter';

/** Categorias iniciais — mesmas do desktop (electron/database/seed.ts). */
export async function seedInitialCategories(db: DbAdapter): Promise<boolean> {
  const res = await db.first<{ count: number }>('SELECT COUNT(*) as count FROM categories');
  if ((res?.count || 0) > 0) return false;

  const defaultCategories: [string, string, string, string][] = [
    ['Salário', 'INCOME', '#10b981', 'Wallet'],
    ['Freelance / Extra', 'INCOME', '#3b82f6', 'DollarSign'],
    ['Investimentos', 'INCOME', '#8b5cf6', 'TrendingUp'],
    ['Outras Receitas', 'INCOME', '#94a3b8', 'PlusCircle'],
    ['Moradia', 'EXPENSE', '#1e293b', 'Home'],
    ['Alimentação', 'EXPENSE', '#10b981', 'Utensils'],
    ['Transporte', 'EXPENSE', '#3b82f6', 'Car'],
    ['Lazer', 'EXPENSE', '#f59e0b', 'Smile'],
    ['Saúde', 'EXPENSE', '#ec4899', 'Heart'],
    ['Educação', 'EXPENSE', '#8b5cf6', 'BookOpen'],
    ['Investimentos', 'EXPENSE', '#8b5cf6', 'TrendingUp'],
    ['Empréstimos e Financiamentos', 'EXPENSE', '#ef4444', 'Landmark'],
    ['Compras e Eletrônicos', 'EXPENSE', '#f97316', 'ShoppingBag'],
    ['Assinaturas e Serviços', 'EXPENSE', '#06b6d4', 'Tv'],
    ['Cuidados Pessoais', 'EXPENSE', '#ec4899', 'Sparkles'],
    ['Vestuário e Calçados', 'EXPENSE', '#14b8a6', 'Shirt'],
    ['Cartão e Encargos', 'EXPENSE', '#a855f7', 'CreditCard'],
    ['Outras Despesas', 'EXPENSE', '#94a3b8', 'Tag'],
  ];

  for (const cat of defaultCategories) {
    await db.run('INSERT INTO categories (name, type, color, icon) VALUES (?, ?, ?, ?)', cat);
  }
  return true;
}
