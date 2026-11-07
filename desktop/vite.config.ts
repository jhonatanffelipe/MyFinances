import react from '@vitejs/plugin-react';
import path from 'node:path';
import { defineConfig } from 'vite';
import electron from 'vite-plugin-electron/simple';

// Pacote compartilhado com o mobile (TypeScript puro, sem dependências de runtime).
// Resolvido pelo código-fonte: não há build nem workspace hoisted (o desktop usa React 18
// e o mobile React 19, que não podem dividir o mesmo node_modules).
const coreAlias = { '@myfinances/core': path.resolve(__dirname, '../packages/core/src/index.ts') };

export default defineConfig({
  plugins: [
    react(),
    electron({
      main: {
        entry: 'electron/main.ts',
        vite: {
          resolve: { alias: coreAlias },
          build: {
            rollupOptions: {
              // ws tem dependências nativas opcionais (bufferutil); vai empacotado em node_modules
              external: ['sql.js', 'ws', 'bufferutil', 'utf-8-validate'],
            },
          },
        },
      },
      preload: {
        input: path.join(__dirname, 'electron/preload.ts'),
        vite: {
          build: {
            rollupOptions: {
              output: {
                format: 'cjs',
                entryFileNames: '[name].js',
              },
            },
          },
        },
      },
      renderer: process.env.NODE_ENV === 'test' ? undefined : {},
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      ...coreAlias,
    },
  },
  optimizeDeps: {
    exclude: ['sql.js'],
  },
});
