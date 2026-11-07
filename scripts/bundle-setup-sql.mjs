// Gera supabase/setup.sql: todas as migrações concatenadas, em ordem, numa transação só.
// É o arquivo que o usuário final cola no SQL Editor do próprio projeto Supabase.
// As migrações são idempotentes, então o setup.sql pode ser rodado de novo sem erro.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const migrationsDir = join(root, 'supabase', 'migrations');
const outFile = join(root, 'supabase', 'setup.sql');

const files = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

const parts = files.map((f) => {
  const sql = readFileSync(join(migrationsDir, f), 'utf8').trim();
  return `-- >>>>>>>>>> ${f}\n${sql}\n`;
});

const header = `-- =====================================================================
-- MyFinances ${pkg.version} · setup.sql (GERADO por yarn db:bundle — não editar)
-- Cole tudo no SQL Editor do seu projeto Supabase e clique em Run.
-- Pode ser executado de novo: os comandos são idempotentes.
-- =====================================================================
begin;
`;

writeFileSync(outFile, `${header}\n${parts.join('\n')}\ncommit;\n`);
console.log(`setup.sql gerado com ${files.length} migrações: ${outFile}`);
