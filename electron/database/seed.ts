export function seedInitialCategories(
  db: any,
  queryObjectFn: (sql: string, params?: any[]) => any | null
) {
  const res = queryObjectFn('SELECT COUNT(*) as count FROM categories');
  const catCount = res?.count || 0;

  if (catCount === 0) {
    // Cores alinhadas à paleta do design
    const defaultCategories = [
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
      ['Outras Despesas', 'EXPENSE', '#94a3b8', 'Tag'],
    ];

    for (const cat of defaultCategories) {
      db.run('INSERT INTO categories (name, type, color, icon) VALUES (?, ?, ?, ?)', cat);
    }
  }
}
