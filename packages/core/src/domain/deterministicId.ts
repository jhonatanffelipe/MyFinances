/**
 * uuid determinístico a partir de uma chave (hash de 128 bits, cyrb128).
 *
 * Usado onde o servidor tem unicidade por chave natural e dois aparelhos offline
 * criariam a mesma linha com ids diferentes. Ex.: a baixa de um fixo no mês é única por
 * (fixo, mês); com id derivado da chave, os dois aparelhos geram o MESMO id e o push
 * do segundo vira um update comum em vez de violar a unicidade.
 * Não é criptográfico; só precisa espalhar bem.
 */
export function deterministicUuid(key: string): string {
  let h1 = 1779033703;
  let h2 = 3144134277;
  let h3 = 1013904242;
  let h4 = 2773480762;
  for (let i = 0; i < key.length; i++) {
    const k = key.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  const hex = [h1 ^ h2 ^ h3 ^ h4, h2 ^ h1, h3 ^ h1, h4 ^ h1].map((n) => (n >>> 0).toString(16).padStart(8, '0')).join('');
  // Formata como uuid v4 válido (versão 4, variante RFC 4122)
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${((parseInt(hex[16], 16) & 3) | 8).toString(16)}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
