/** Arredonda para centavos. No SQLite o valor é REAL; no Postgres, numeric(14,2). */
export function roundMoney(value: number): number {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

/** Soma em centavos inteiros para não acumular erro de ponto flutuante. */
export function sumMoney(values: number[]): number {
  return values.reduce((acc, v) => acc + Math.round(Number(v) * 100), 0) / 100;
}
