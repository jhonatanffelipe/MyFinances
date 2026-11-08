// Monta versions/v<versão>/ com os arquivos da release:
//   - versionados no git: setup.sql, migrations/, pair-device/, guia-instalacao.md, CHANGELOG.md
//     (e o README.md da versão, escrito à mão)
//   - só no GitHub Release (passam de 100 MB, ficam no .gitignore):
//       MyFinances-Setup-<versão>.exe   ← desktop/release (yarn build:win)
//       MyFinances-<versão>-arm64.dmg   ← desktop/release (yarn build:mac)
//       MyFinances-<versão>.apk         ← baixado do EAS (yarn eas:apk) e copiado à mão
// Publicar: gh release create v<versão> versions/v<versão>/* --target master
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => JSON.parse(readFileSync(join(root, p), 'utf8'));

const version = read('package.json').version;
const versions = {
  desktop: read('desktop/package.json').version,
  mobile: read('mobile/package.json').version,
  'app.json': read('mobile/app.json').expo.version,
};
const mismatched = Object.entries(versions).filter(([, v]) => v !== version);
if (mismatched.length) {
  console.error(`Versão da raiz ${version} diferente de: ${mismatched.map(([k, v]) => `${k} ${v}`).join(', ')}.`);
  process.exit(1);
}

execFileSync(process.execPath, [join(root, 'scripts', 'bundle-setup-sql.mjs')], { stdio: 'inherit' });

const out = join(root, 'versions', `v${version}`);
mkdirSync(out, { recursive: true });

const copy = (from, to) => {
  rmSync(join(out, to), { recursive: true, force: true });
  cpSync(join(root, from), join(out, to), { recursive: true });
};
copy('supabase/setup.sql', 'setup.sql');
copy('supabase/migrations', 'migrations');
copy('supabase/functions/pair-device/index.ts', 'pair-device/index.ts');
copy('docs/guia-instalacao.md', 'guia-instalacao.md');
copy('CHANGELOG.md', 'CHANGELOG.md');

const installers = [
  { file: `MyFinances-Setup-${version}.exe`, from: `desktop/release/MyFinances-Setup-${version}.exe`, how: 'yarn build:win em desktop/' },
  { file: `MyFinances-${version}-arm64.dmg`, from: `desktop/release/MyFinances-${version}-arm64.dmg`, how: 'yarn build:mac em desktop/' },
  { file: `MyFinances-${version}.apk`, from: null, how: 'yarn eas:apk em mobile/ e copie o .apk baixado' },
];
const missing = [];
for (const { file, from, how } of installers) {
  if (from && existsSync(join(root, from))) copy(from, file);
  if (!existsSync(join(out, file))) missing.push(`${file} (${how})`);
}

console.log(`Release montada em ${out}`);
if (missing.length) console.warn(`Faltando:\n  - ${missing.join('\n  - ')}`);
