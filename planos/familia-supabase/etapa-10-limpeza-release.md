# Etapa 10 — Limpeza, release e guia para os amigos

**Objetivo:** deixar o projeto pronto para entregar a outras famílias.

## Tarefas

### Código
- [ ] Remover os restos de OneDrive (Graph, `.lock`, arquivos de conflito, escolha de pasta)
  de ambos os apps. O SQLite **fica**, agora como banco local interno. Atualizar o `README.md`
  raiz, que hoje descreve o "Banco compartilhado pelo OneDrive".
- [ ] Remover `desktop/package-lock.json` (o projeto usa Yarn).
- [ ] Desktop: script `build:win` (`electron-builder --win --x64`), saída em `release/`
  em vez de `dist-electron/`, e `description`/`author` no `package.json`.
- [ ] Mobile: build do APK via EAS sem `microsoftClientId`.

### Release
- [ ] Antes de começar a v2: criar a tag `v1.0.0` no commit atual (SQLite + OneDrive), para
  ter o instalador antigo reproduzível.
- [ ] Subir `version` para `2.0.0` em `desktop/package.json`, `mobile/package.json` e
  `mobile/app.json` (`version` e `android.versionCode`). Na release: tag `v2.0.0` e
  `app_meta.schema_version = 1`, ou seja, a versão do schema é independente da versão do app.
- [ ] Cada release publica: `MyFinances-Setup-x.y.z.exe`, o `.apk`, o `setup.sql` completo e
  `migrations/` incrementais desde a versão anterior.
- [ ] `CHANGELOG` indicando quando há migração de banco obrigatória.
- [ ] (Fora da v2.0.0) auto-update do desktop com `electron-updater` apontando para GitHub
  Releases.

### Guia do usuário (`docs/guia-instalacao.md`)
1. Criar conta grátis em supabase.com e um projeto novo (região São Paulo).
2. **SQL Editor** → colar o `setup.sql` → Run.
3. **Authentication → Providers → Email**: desligar "Confirm email" (ou configurar SMTP).
   **Edge Functions → Create function** `pair-device`: colar o código da release e desligar
   "Verify JWT" (ou `npx supabase functions deploy pair-device --no-verify-jwt`). É opcional:
   sem ela, conectar o celular pelo QR pede a senha uma vez.
4. **Project Settings → API**: copiar a *Project URL* e a *Publishable key*. **Nunca** usar a
   secret/service_role.
5. Instalar o app **no computador**, escolher "Criar meu banco" e colar URL + key.
6. Criar a conta e a família. Quem já usa a v1 escolhe **"Importar meu banco da v1"** e
   seleciona o `db_myfinances.sqlite`.
7. **Celular (seu ou de outra pessoa da família):** no computador, Perfil → **Conectar
   celular**; no celular, **Ler QR Code** e escolher "Sou eu" ou "Sou outra pessoa da
   família". Para quem está longe: Membros → Convidar → mandar o código pelo WhatsApp.
8. Aviso: no plano gratuito, o projeto pausa após ~7 dias sem uso. Para reativar:
   Dashboard → Restore.
9. Backup: Supabase → Database → Backups (plano pago) ou `pg_dump` pela connection string,
   com passo a passo.

## Pronto quando

- Um amigo, só com o guia, instala, conecta, cria a família, conecta o próprio celular pelo QR
  e convida alguém sem sua ajuda.
