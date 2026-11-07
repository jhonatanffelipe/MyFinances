import type { QrPreview } from '@myfinances/core';

/**
 * QR lido na tela de câmera, compartilhado com "Quem vai usar?" e "Confirme no
 * computador" (o código é longo demais para ir como parâmetro de rota).
 */
let current: { text: string; preview: QrPreview } | null = null;

export const qrFlow = {
  set(text: string, preview: QrPreview) {
    current = { text, preview };
  },
  get() {
    return current;
  },
  clear() {
    current = null;
  },
};
