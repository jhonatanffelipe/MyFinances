import { getDatabase, queryObjects } from '../database/index.js';
import { ImportParseResult, ImportPreviewItem } from '../../src/interfaces/IElectronBridge.js';

interface RawNubankItem {
  date: string;
  title: string;
  amount: number;
  isInvoicePayment: boolean;
}

/**
 * Faz o parsing de uma linha CSV respeitando aspas duplas e vírgulas internas.
 */
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * Converte valor em formato monetário brasileiro ("14,90", "- 2.947,68", "1.250,00") para número float.
 */
function parseBrazilianNumber(valueStr: string): number {
  if (!valueStr) return 0;
  // Remove aspas
  let cleaned = valueStr.replace(/["']/g, '').trim();

  // Detecta sinal negativo com ou sem espaço (ex: "- 2.947,68")
  let isNegative = false;
  if (cleaned.startsWith('-')) {
    isNegative = true;
    cleaned = cleaned.substring(1).trim();
  }

  // Remove pontos de milhar e substitui vírgula decimal por ponto
  cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  if (isNaN(num)) return 0;
  return isNegative ? -num : num;
}

/**
 * Normaliza datas para YYYY-MM-DD
 */
function normalizeDate(dateStr: string): string {
  const cleaned = (dateStr || '').replace(/["']/g, '').trim();
  // Se já estiver no padrão YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
    return cleaned;
  }
  // Se estiver no padrão DD/MM/YYYY
  const brMatch = cleaned.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (brMatch) {
    return `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`;
  }
  return cleaned;
}

/**
 * Lê o conteúdo do arquivo CSV do Nubank e extrai as linhas cruas.
 */
export function parseNubankCsv(csvContent: string): RawNubankItem[] {
  const lines = csvContent.split(/\r?\n/);
  const items: RawNubankItem[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols = parseCsvLine(line);
    if (cols.length < 3) continue;

    // Detecta cabeçalho (ex: date,title,amount)
    if (cols[0].toLowerCase() === 'date' || cols[1].toLowerCase() === 'title') {
      continue;
    }

    const rawDate = cols[0];
    const rawTitle = cols[1];
    const rawAmount = cols[2];

    const normalizedDate = normalizeDate(rawDate);
    const parsedAmount = parseBrazilianNumber(rawAmount);

    const titleLower = rawTitle.toLowerCase();
    const isPayment =
      titleLower.includes('pagamento recebido') ||
      titleLower.includes('fatura paga') ||
      parsedAmount < 0;

    items.push({
      date: normalizedDate,
      title: rawTitle,
      amount: parsedAmount,
      isInvoicePayment: isPayment,
    });
  }

  return items;
}

// Mapeamento de palavras-chave para categorias padrão
const KEYWORD_CATEGORY_RULES: Array<{
  keywords: string[];
  categoryNames: string[];
}> = [
  {
    keywords: [
      'uber',
      '99',
      'combustivel',
      'gasolina',
      'posto',
      'pedagio',
      'pedágio',
      'estapar',
      'estacionamento',
      'rrt comercio',
      'sem parar',
      'veloe',
      'auto posto',
    ],
    categoryNames: ['transporte', 'combustível', 'veículo', 'carro'],
  },
  {
    keywords: [
      'bar',
      'restaurante',
      'grill',
      'choc',
      'cafe',
      'café',
      'padaria',
      'ifood',
      'burguer',
      'burger',
      'pizza',
      'lanche',
      'mcdonald',
      'refeição',
      'mercado',
      'supermercado',
      'atacado',
      'açougue',
      'el cholo',
      'vicente v moraes',
      'mr.grill',
      'cathedral sports',
      'padaria',
      'panificadora',
    ],
    categoryNames: ['alimentação', 'refeição', 'restaurante', 'mercado'],
  },
  {
    keywords: [
      'farmacia',
      'farmácia',
      'droga',
      'drogaria',
      'medico',
      'médico',
      'consulta',
      'hospital',
      'odonto',
      'dentista',
      'laboratorio',
      'laboratório',
      'exame',
      'raia',
      'drogasil',
      'pague menos',
    ],
    categoryNames: ['saúde', 'farmácia', 'médico'],
  },
  {
    keywords: [
      'netflix',
      'spotify',
      'prime video',
      'amazon prime',
      'disney',
      'hbo',
      'max',
      'cinema',
      'ingresso',
      'show',
      'steam',
      'playstation',
      'xbox',
      'twitch',
      'youtube',
    ],
    categoryNames: ['lazer', 'entretenimento', 'assinaturas'],
  },
  {
    keywords: [
      'condominio',
      'condomínio',
      'aluguel',
      'enel',
      'cpfl',
      'luz',
      'energia',
      'agua',
      'água',
      'sabesp',
      'gas',
      'gás',
      'iptu',
      'internet',
      'claro',
      'vivo',
      'tim',
    ],
    categoryNames: ['moradia', 'habitação', 'contas residenciais'],
  },
  {
    keywords: [
      'livraria',
      'curso',
      'escola',
      'faculdade',
      'universidade',
      'udemy',
      'alura',
      'livro',
      'educação',
    ],
    categoryNames: ['educação', 'estudos'],
  },
  {
    keywords: [
      'decathlon',
      'lojas colombo',
      'colombo',
      'boticario',
      'oboticario',
      'micheleshiba',
      'hpower',
      'phone center',
      'shopee',
      'mercado livre',
      'amazon',
      'magalu',
      'magazine',
      'zara',
      'renner',
      'riachuelo',
      'c&a',
    ],
    categoryNames: ['outras despesas', 'compras', 'vestuário'],
  },
];

/**
 * Sugere a melhor categoria com base no título do lançamento e categorias existentes no banco.
 */
function suggestCategory(title: string, categories: any[]): number | null {
  const titleLower = title.toLowerCase();

  for (const rule of KEYWORD_CATEGORY_RULES) {
    const hasKeyword = rule.keywords.some((kw) => titleLower.includes(kw));
    if (hasKeyword) {
      for (const targetName of rule.categoryNames) {
        const matched = categories.find((c) =>
          c.name.toLowerCase().includes(targetName)
        );
        if (matched) return matched.id;
      }
    }
  }

  // Tenta correspondência direta com o nome de qualquer categoria cadastrada
  const directMatch = categories.find((c) =>
    titleLower.includes(c.name.toLowerCase())
  );
  if (directMatch) return directMatch.id;

  return null;
}

/**
 * Cruza os lançamentos da planilha com o banco de dados SQLite para identificar
 * possíveis duplicidades (despesas fixas e movimentações já cadastradas) e sugerir categorias.
 */
export function analyzeImportItems(
  rawItems: RawNubankItem[],
  creditCardId: number | null = null,
  fileName: string = ''
): ImportParseResult {
  const db = getDatabase();
  const categories: any[] = db ? queryObjects('SELECT id, name, type FROM categories') : [];
  const existingMovements: any[] = db
    ? queryObjects('SELECT id, description, amount, date, credit_card_id, fixed_expense_id FROM movements')
    : [];
  const activeFixedExpenses: any[] = db
    ? queryObjects("SELECT id, description, amount, due_day, active FROM fixed_expenses WHERE active = 1 AND COALESCE(type, 'EXPENSE') = 'EXPENSE'")
    : [];

  let duplicateCount = 0;
  let invoicePaymentCount = 0;
  let totalExpense = 0;
  let totalIncome = 0;

  const items: ImportPreviewItem[] = rawItems.map((raw, index) => {
    const absAmount = Math.abs(raw.amount);
    const type: 'EXPENSE' | 'INCOME' = raw.isInvoicePayment ? 'INCOME' : 'EXPENSE';

    if (type === 'EXPENSE') {
      totalExpense += absAmount;
    } else {
      totalIncome += absAmount;
    }

    if (raw.isInvoicePayment) {
      invoicePaymentCount++;
    }

    // Sugestão inteligente de categoria
    const suggestedCatId = suggestCategory(raw.title, categories);

    // Detecção de duplicidade
    let isDuplicate = false;
    let duplicateReason: string | undefined;
    let existingMovementId: number | undefined;
    let existingFixedExpenseId: number | undefined;

    // 1. Verifica contra movimentações já cadastradas no banco
    const matchedMovement = existingMovements.find((m) => {
      const amountMatch = Math.abs(Number(m.amount) - absAmount) < 0.01;
      if (!amountMatch) return false;

      // Mesmo dia ou intervalo de tolerância de 2 dias
      const mDate = m.date;
      const daysDiff = Math.abs(
        (new Date(mDate).getTime() - new Date(raw.date).getTime()) / (1000 * 60 * 60 * 24)
      );

      const titleA = m.description.toLowerCase().replace(/[^a-z0-9]/g, '');
      const titleB = raw.title.toLowerCase().replace(/[^a-z0-9]/g, '');
      const descMatch =
        titleA.includes(titleB) ||
        titleB.includes(titleA) ||
        (titleA.slice(0, 5) === titleB.slice(0, 5) && titleA.length >= 5);

      return daysDiff <= 3 && descMatch;
    });

    if (matchedMovement) {
      isDuplicate = true;
      existingMovementId = matchedMovement.id;
      duplicateReason = `Já registrado em Movimentações (${matchedMovement.date} - "${matchedMovement.description}")`;
    }

    // 2. Se não encontrou em movimentações, verifica contra despesas fixas ativas
    if (!isDuplicate) {
      const matchedFixed = activeFixedExpenses.find((f) => {
        const amountMatch = Math.abs(Number(f.amount) - absAmount) < 0.01;
        if (!amountMatch) return false;

        const titleA = f.description.toLowerCase().replace(/[^a-z0-9]/g, '');
        const titleB = raw.title.toLowerCase().replace(/[^a-z0-9]/g, '');
        const descMatch =
          titleA.includes(titleB) ||
          titleB.includes(titleA) ||
          (titleA.slice(0, 4) === titleB.slice(0, 4) && titleA.length >= 4);

        return descMatch;
      });

      if (matchedFixed) {
        isDuplicate = true;
        existingFixedExpenseId = matchedFixed.id;
        duplicateReason = `Possível duplicata da Despesa Fixa "${matchedFixed.description}" (R$ ${Number(matchedFixed.amount).toFixed(2)})`;
      }
    }

    if (isDuplicate) {
      duplicateCount++;
    }

    // Por padrão: desmarca duplicatas e pagamentos de fatura
    const selected = !isDuplicate && !raw.isInvoicePayment;

    return {
      id: `import_row_${index}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      date: raw.date,
      originalDate: raw.date,
      description: raw.title,
      amount: absAmount,
      type,
      categoryId: suggestedCatId,
      creditCardId: creditCardId,
      isInvoicePayment: raw.isInvoicePayment,
      potentialDuplicate: {
        isDuplicate,
        reason: duplicateReason,
        existingMovementId,
        existingFixedExpenseId,
      },
      selected,
    };
  });

  return {
    items,
    totalCount: items.length,
    duplicateCount,
    invoicePaymentCount,
    totalExpense,
    totalIncome,
    fileName,
  };
}
