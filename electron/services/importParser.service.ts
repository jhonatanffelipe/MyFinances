import { getDatabase, queryObjects } from '../database/index.js';
import { ImportBankType, ImportParseResult, ImportPreviewItem } from '../../src/interfaces/IElectronBridge.js';

export interface RawImportItem {
  date: string;
  title: string;
  amount: number;
  isInvoicePayment: boolean;
  categoryHint?: string;
  transactionTypeHint?: string;
  bank?: string;
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
 * Converte valor em formato monetário brasileiro ("R$ 40,90", "-R$ 842,13", "14,90", "- 2.947,68", "1.250,00") para float.
 */
export function parseBrazilianNumber(valueStr: string): number {
  if (!valueStr) return 0;
  const str = String(valueStr).trim();
  const isNegative = str.includes('-');
  // Remove tudo exceto dígitos, vírgula e ponto
  const cleaned = str.replace(/[^\d,\.]/g, '');
  if (!cleaned) return 0;

  let normalized = cleaned;
  if (cleaned.includes(',') && cleaned.includes('.')) {
    if (cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')) {
      normalized = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      normalized = cleaned.replace(/,/g, '');
    }
  } else if (cleaned.includes(',')) {
    normalized = cleaned.replace(',', '.');
  }

  const num = parseFloat(normalized);
  if (isNaN(num)) return 0;
  return isNegative ? -num : num;
}

/**
 * Normaliza datas para YYYY-MM-DD
 */
export function normalizeDate(dateStr: string): string {
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
 * Detecta automaticamente o formato bancário da planilha a partir dos cabeçalhos.
 */
export function detectBankType(csvContent: string): 'NUBANK' | 'INTER' {
  const firstLines = csvContent.split(/\r?\n/).slice(0, 5).join(' ').toLowerCase();
  if (
    firstLines.includes('lançamento') ||
    firstLines.includes('lancamento') ||
    firstLines.includes('compra à vista') ||
    firstLines.includes('compra a vista') ||
    firstLines.includes('parcela ')
  ) {
    return 'INTER';
  }
  return 'NUBANK';
}

/**
 * Lê o conteúdo do arquivo CSV do Nubank (date,title,amount ou date,category,title,amount).
 */
export function parseNubankCsv(csvContent: string): RawImportItem[] {
  const lines = csvContent.split(/\r?\n/);
  const items: RawImportItem[] = [];

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
    const rawTitle = cols.length >= 4 ? cols[2] : cols[1];
    const rawCategory = cols.length >= 4 ? cols[1] : '';
    const rawAmount = cols.length >= 4 ? cols[3] : cols[2];

    const normalizedDate = normalizeDate(rawDate);
    const parsedAmount = parseBrazilianNumber(rawAmount);

    const titleLower = rawTitle.toLowerCase();
    const isPayment =
      titleLower.includes('pagamento recebido') ||
      titleLower.includes('fatura paga') ||
      parsedAmount < 0;

    items.push({
      date: normalizedDate,
      title: rawTitle.trim(),
      amount: parsedAmount,
      isInvoicePayment: isPayment,
      categoryHint: rawCategory,
      bank: 'Nubank',
    });
  }

  return items;
}

/**
 * Lê o conteúdo do arquivo CSV do Banco Inter:
 * Cabeçalho esperado: "Data","Lançamento","Categoria","Tipo","Valor"
 */
export function parseInterCsv(csvContent: string): RawImportItem[] {
  const lines = csvContent.split(/\r?\n/);
  const items: RawImportItem[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols = parseCsvLine(line);
    if (cols.length < 3) continue;

    // Detecta cabeçalho
    const firstCol = cols[0].toLowerCase().replace(/[^a-z]/g, '');
    const secondCol = cols[1].toLowerCase().replace(/[^a-z]/g, '');
    if (
      firstCol === 'data' &&
      (secondCol.includes('lancamento') || secondCol.includes('lanamento') || secondCol.includes('descricao'))
    ) {
      continue;
    }

    // Colunas do Banco Inter:
    // 0: Data ("07/10/2026")
    // 1: Lançamento ("EBN*SPOTIFY")
    // 2: Categoria ("PAGAMENTOS")
    // 3: Tipo ("Compra à vista" ou "Parcela 2/12")
    // 4: Valor ("R$ 40,90" ou "-R$ 842,13")
    const rawDate = cols[0];
    const rawTitle = cols[1];
    const rawCategory = cols.length >= 5 ? cols[2] : '';
    const rawTipo = cols.length >= 5 ? cols[3] : '';
    const rawAmount = cols.length >= 5 ? cols[4] : cols[2];

    const normalizedDate = normalizeDate(rawDate);
    const parsedAmount = parseBrazilianNumber(rawAmount);

    // Limpa espaçamentos múltiplos internos comuns no extrato do Inter
    const cleanTitle = rawTitle.replace(/\s+/g, ' ').trim();
    const titleLower = cleanTitle.toLowerCase();

    const isPayment =
      parsedAmount < 0 ||
      titleLower.includes('pagamento on line') ||
      titleLower.includes('pagamento de fatura') ||
      titleLower.includes('fatura paga') ||
      titleLower.includes('pagamento recebido');

    items.push({
      date: normalizedDate,
      title: cleanTitle,
      amount: parsedAmount,
      isInvoicePayment: isPayment,
      categoryHint: rawCategory.replace(/["']/g, '').trim(),
      transactionTypeHint: rawTipo.replace(/["']/g, '').trim(),
      bank: 'Banco Inter',
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
      'agilios',
      'junta comercial',
      'precisa solucoes',
      'contadev',
    ],
    categoryNames: ['agilios', 'assinaturas e serviços', 'outras despesas'],
  },
  {
    keywords: [
      'investimento',
      'aporte',
      'nuinvest',
      'xp ',
      'rico ',
      'binance',
      'b3',
      'tesouro direto',
    ],
    categoryNames: ['investimentos'],
  },
  {
    keywords: [
      'empréstimo',
      'emprestimo',
      'financiamento',
      'itau sob medida',
      'credito pessoal',
    ],
    categoryNames: ['empréstimos e financiamentos', 'empréstimos', 'emprestimos'],
  },
  {
    keywords: [
      'parcelamento de fatura',
      'parc fat',
      'encargos fatura',
      'iof',
      'anuidade',
    ],
    categoryNames: ['cartão e encargos', 'cartão'],
  },
  {
    keywords: [
      'boticario',
      'oboticario',
      'natura',
      'sephora',
      'barbearia',
      'salao',
      'salão',
      'cosmetico',
      'cosmético',
    ],
    categoryNames: ['cuidados pessoais', 'beleza'],
  },
  {
    keywords: [
      'decathlon',
      'netshoes',
      'zara',
      'renner',
      'riachuelo',
      'c&a',
      'centauro',
      'nike',
      'adidas',
      'micheleshiba',
    ],
    categoryNames: ['vestuário e calçados', 'vestuário', 'vestuario'],
  },
  {
    keywords: [
      'assiny',
      'chatgpt',
      'openai',
      'apple.com/bill',
      'deezer',
    ],
    categoryNames: ['assinaturas e serviços', 'assinaturas'],
  },
  {
    keywords: [
      'lojas colombo',
      'colombo',
      'hpower',
      'phone center',
      'shopee',
      'mercado livre',
      'amazon',
      'magalu',
      'magazine',
      'aliexpress',
      'ellin',
    ],
    categoryNames: ['compras e eletrônicos', 'compras', 'outras despesas'],
  },
];

const INTER_CATEGORY_KEYWORDS: Record<string, string[]> = {
  PAGAMENTOS: ['cartão e encargos', 'assinaturas e serviços', 'pagamento', 'outras despesas'],
  COMPRAS: ['compras e eletrônicos', 'compras', 'vestuário e calçados', 'vestuário', 'outras despesas'],
  ENTRETENIMENTO: ['lazer', 'entretenimento', 'assinaturas e serviços', 'assinaturas'],
  SERVICOS: ['assinaturas e serviços', 'agilios', 'serviços', 'outras despesas'],
  SERVIÇOS: ['assinaturas e serviços', 'agilios', 'serviços', 'outras despesas'],
  ESPORTES: ['vestuário e calçados', 'saúde', 'esportes', 'lazer'],
  LIVRARIAS: ['educação', 'educacao', 'estudos', 'livros'],
  ALIMENTACAO: ['alimentação', 'alimentacao', 'refeição', 'refeicao', 'restaurante'],
  ALIMENTAÇÃO: ['alimentação', 'alimentacao', 'refeição', 'refeicao', 'restaurante'],
  TRANSPORTE: ['transporte', 'combustível', 'combustivel', 'veículo', 'veiculo'],
  SAUDE: ['saúde', 'saude', 'cuidados pessoais', 'farmácia', 'médico'],
  SAÚDE: ['saúde', 'saude', 'cuidados pessoais', 'farmácia', 'médico'],
  VIAGEM: ['viagem', 'lazer', 'transporte'],
  FARMACIA: ['saúde', 'saude', 'cuidados pessoais', 'farmácia'],
  FARMÁCIA: ['saúde', 'saude', 'cuidados pessoais', 'farmácia'],
};

/**
 * Sugere a melhor categoria com base na categoria informada pelo banco, no título do lançamento e regras.
 */
function suggestCategory(
  title: string,
  categories: any[],
  categoryHint?: string
): number | null {
  const titleLower = title.toLowerCase();

  // 1. Tenta mapear pela categoria original da instituição (ex: Banco Inter "ENTRETENIMENTO", "SERVICOS", etc.)
  if (categoryHint) {
    const hintKey = categoryHint.toUpperCase().trim();
    const targets = INTER_CATEGORY_KEYWORDS[hintKey];
    if (targets) {
      for (const target of targets) {
        const matched = categories.find((c) => c.name.toLowerCase().includes(target));
        if (matched) return matched.id;
      }
    }
    const directHintMatch = categories.find(
      (c) =>
        c.name.toLowerCase().includes(categoryHint.toLowerCase()) ||
        categoryHint.toLowerCase().includes(c.name.toLowerCase())
    );
    if (directHintMatch) return directHintMatch.id;
  }

  // 2. Regras por palavras-chave no título (Uber, Ifood, Spotify, etc.)
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

  // 3. Tenta correspondência direta com o nome de qualquer categoria cadastrada
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
  rawItems: RawImportItem[],
  creditCardId: number | null = null,
  fileName: string = '',
  detectedBank: ImportBankType = 'AUTO'
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

    // Sugestão inteligente de categoria considerando dica de banco e palavras-chave
    const suggestedCatId = suggestCategory(raw.title, categories, raw.categoryHint);

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

    // Define notas explicativas para cada instituição
    let notes = 'Importado via fatura';
    if (raw.bank === 'Banco Inter') {
      notes = raw.transactionTypeHint
        ? `Banco Inter · ${raw.transactionTypeHint}`
        : 'Importado via Banco Inter';
    } else if (raw.bank === 'Nubank') {
      notes = 'Importado via extrato Nubank';
    }

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
      notes,
      bank: raw.bank,
      categoryHint: raw.categoryHint,
      transactionTypeHint: raw.transactionTypeHint,
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
    detectedBank,
  };
}

/**
 * Função principal para analisar arquivo CSV a partir do tipo selecionado ou detecção automática.
 */
export function parseAndAnalyzeImport(
  csvContent: string,
  options: {
    creditCardId?: number | null;
    fileName?: string;
    bankType?: ImportBankType;
  } = {}
): ImportParseResult {
  const bankType = options.bankType || 'AUTO';
  const effectiveBank: 'NUBANK' | 'INTER' =
    bankType === 'AUTO' ? detectBankType(csvContent) : bankType;

  const rawItems =
    effectiveBank === 'INTER' ? parseInterCsv(csvContent) : parseNubankCsv(csvContent);

  return analyzeImportItems(
    rawItems,
    options.creditCardId || null,
    options.fileName || '',
    effectiveBank
  );
}
