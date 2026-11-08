# Versões do MyFinances

Cada pasta guarda os arquivos de uma versão. Os instaladores (`.exe`, `.dmg`, `.apk`) ficam
anexados ao [GitHub Release](https://github.com/jhonatanffelipe/MyFinances/releases)
correspondente; aqui ficam o banco (`setup.sql`, `migrations/`), a Edge Function, o guia e o
CHANGELOG daquela versão.

| Versão | Data | Plataformas | Migração de banco | Notas |
|---|---|---|---|---|
| [v2.0.0](v2.0.0/README.md) | 2026-11-07 | Windows, macOS, Android | Instalação nova (`setup.sql`, schema 1) | Família, Supabase próprio e offline-first |
| v1.0.0 | — | Windows, Android | — | SQLite compartilhado pelo OneDrive (tag `v1.0.0`) |

## Montar uma versão nova

```bash
# 1. Suba a versão em package.json (raiz), desktop/package.json, mobile/package.json
#    e mobile/app.json (version e android.versionCode)
cd desktop && yarn build:win && yarn build:mac && cd ..
cd mobile && yarn eas:apk && cd ..   # baixe o .apk para versions/vX.Y.Z/MyFinances-X.Y.Z.apk
yarn release:assets                   # monta versions/vX.Y.Z/ e avisa o que falta

# 2. Escreva versions/vX.Y.Z/README.md e o CHANGELOG, faça o commit e o merge na master

# 3. Publique (cria a tag a partir da master e anexa os instaladores)
gh release create vX.Y.Z --target master --title "MyFinances vX.Y.Z" \
  --notes-file versions/vX.Y.Z/README.md versions/vX.Y.Z/*.{exe,dmg,apk} versions/vX.Y.Z/setup.sql
```
