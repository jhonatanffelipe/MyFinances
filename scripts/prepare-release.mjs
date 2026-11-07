// Monta release/v<versão>/ com os arquivos que vão para o GitHub Release:
//   - MyFinances-Setup-<versão>.exe (se já foi gerado por `yarn build:win` no desktop)
//   - setup.sql (gerado de novo a partir das migrações)
//   - migrations/ (incrementais, para quem já tem o banco de uma versão anterior)
//   - pair-device/index.ts (Edge Function opcional do QR "Sou eu")
//   - guia-instalacao.md e CHANGELOG.md
// O .apk vem do EAS (link de download); coloque-o na mesma pasta antes de publicar.
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => JSON.parse(readFileSync(join(root, p), 'utf8'));

const version = read('package.json').version;
const desktopVersion = read('desktop/package.json').version;
const mobileVersion = read('mobile/package.json').version;
const appJsonVersion = read('mobile/app.json').expo.version;

const mismatched = [desktopVersion, mobileVersion, appJsonVersion].filter((v) => v !== version);
if (mismatched.length) {
  console.error(
    `Versões diferentes: raiz ${version}, desktop ${desktopVersion}, mobile ${mobileVersion}, app.json ${appJsonVersion}.`,
  );
  process.exit(1);
}

execFileSync(process.execPath, [join(root, 'scripts', 'bundle-setup-sql.mjs')], { stdio: 'inherit' });

const out = join(root, 'release', `v${version}`);
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const copy = (from, to) => cpSync(join(root, from), join(out, to), { recursive: true });
copy('supabase/setup.sql', 'setup.sql');
copy('supabase/migrations', 'migrations');
copy('supabase/functions/pair-device/index.ts', 'pair-device/index.ts');
copy('docs/guia-instalacao.md', 'guia-instalacao.md');
copy('CHANGELOG.md', 'CHANGELOG.md');

const exe = `desktop/release/MyFinances-Setup-${version}.exe`;
if (existsSync(join(root, exe))) {
  copy(exe, `MyFinances-Setup-${version}.exe`);
} else {
  console.warn(`Aviso: ${exe} não encontrado. Rode "yarn build:win" em desktop/ antes.`);
}

console.log(`Release montada em ${out}`);
console.log(`Falta: baixar o APK do EAS (yarn eas:apk em mobile/) para essa pasta como MyFinances-${version}.apk.`);
