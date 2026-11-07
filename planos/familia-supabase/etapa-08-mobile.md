---
tags:
  - myfinances
  - plano/v2
  - etapa
aliases:
  - "Etapa 8"
  - "Mobile local-first"
etapa: 8
status: concluída
plano: "[[README|Plano v2.0.0]]"
depende_de:
  - "[[etapa-05-auth-familias]]"
---
# Etapa 8 — Mobile local-first

**Objetivo:** o app Android passa a usar o core (expo-sqlite + sincronização com o
Supabase), sem OneDrive. Pode rodar em paralelo às Etapas 6–7, depois da 5.

## Tarefas

- [x] Client supabase-js com sessão no `expo-secure-store`. A sessão pode passar do limite de
  ~2 KB por chave: ficou com o `ChunkedKeyValueStore` da Etapa 4 (divide em pedaços, tudo no
  Keystore), em vez de chave de cifra + armazenamento comum.
- [x] `AppState`: em foreground, `startAutoRefresh()` + pull + reassina o Realtime; em
  background, `stopAutoRefresh()` + flush do outbox + pausa o Realtime.
- [x] Monitor de rede com `@react-native-community/netinfo` para o `SyncEngine`.
- [x] Trocar `mobile/src/hooks/useData.ts` e `mobile/src/data/repositories/*` pelos do core.
  Os repositórios saem do mobile, mas o `expoAdapter` continua (agora vindo do core).
- [x] Primeira tela com **Ler QR Code** como ação principal (`expo-camera` para ler o
  código) e "Conectar manualmente" como alternativa. Telas "Quem vai usar este celular?",
  "Confirme no computador" e mensagens de expirado/recusado/já usado, conforme o
  [[fluxo-conectar-celular|fluxo de conexão do celular]].
- [x] Nome do aparelho para o pedido de aprovação via `expo-device` (já é dependência), por
  exemplo "Moto G (Android)".
- [x] Telas novas/ajustadas: seletor de família,
  filtro por membro, campo "De quem", tipo Transferência e tela de pendências de sync.
- [x] `SyncBanner` passa a mostrar o status do `SyncEngine` (offline / N pendentes / erro).
- [x] Remover: `mobile/src/sync/*` (Graph, msAuth, presence, syncManager), `SyncContext` antigo,
  `MicrosoftLoginModal`, `app/sync.tsx`, o `microsoftClientId` do `app.json` e as dependências
  `expo-auth-session` e `react-native-webview` (se não forem mais usadas). O `expo-sqlite`
  **fica**.
- [x] Migrar `mobile/tests` para o core.

## Herdado da Etapa 4

- [x] Tela **Conectar** com **Ler QR Code** como ação principal, mais Criar meu banco e
  Tenho um código de convite. Usa `checkConnection` e `decodeConnectionCode`.
- [x] Perfil → **Conexão**: ver o projeto, testar, trocar (com logout) e esquecer.
- [x] supabase-js com `auth.storage = mobileSecureStore`.

## Herdado da Etapa 5

- [x] Login, cadastro e "esqueci a senha"; ao abrir, `session.resume({ online })`.
- [x] Ler QR Code: `scan.decode` → "Sou eu" (`scan.execute` → `waitApproval` →
  `completePairing`) ou "Sou outra pessoa" (cadastro/login → `families.join`).
- [x] Onboarding sem família, seletor de família no header, Membros, Perfil e Aparelhos
  conectados.
- [x] `RegisterDevice` após o login (plataforma `android`/`ios`, nome via `expo-device`).
- [x] Remover `mobile/src/data/repositories/auth.ts` e a dependência `scrypt-js`.

## Como ficou (2026-11-07)

- **`AppSession` no core** (`packages/core/src/app/`): a orquestração que estava no
  `AppController` do desktop (conexão, sessão, banco local por usuário, sync, Realtime,
  famílias, abertura offline-first) virou uma classe só, com portas injetadas (client do
  supabase-js, abertura do SQLite, rede, store seguro, nome/plataforma do aparelho). O desktop
  e o mobile são cascas finas sobre ela. Ganhou o QR antes do login (`readConnectionQr`,
  `startPairing`, `completePairing`) e `pause()`/`resume()` para o AppState.
- **`createExpoSqliteAdapter` no core**: `withTransactionAsync` na conexão principal com uma
  fila que serializa escritas e transações (mesma semântica do sql.js). Não usa
  `withExclusiveTransactionAsync`, que abre outra conexão e daria "database is locked" com
  sync e usuário gravando ao mesmo tempo. WAL ligado na abertura.
- **Mobile** (`mobile/src/engine/`): `AppSession` com expo-sqlite, NetInfo, supabase-js,
  `expo-crypto` (uuid) e `expo-device` ("Moto G (Android)"). Telas novas: `connect/`
  (Ler QR Code, "Quem vai usar?", "Confirme no computador", manual, código), login, família,
  Membros, Perfil (dados, senha, aparelhos, conexão), Sincronização; chips Família | Eu |
  membro no Dashboard e em Movimentos; "De quem" e Transferência; seletor de família no header.
- **Corrida no pareamento (corrigida):** se o celular consultava no instante do "Permitir", a
  Edge Function devolvia `APPROVED` sem `token_hash` e o login quebrava. A função agora
  responde `WAITING_APPROVAL` nesse caso, e o core trata a resposta antiga do mesmo jeito.
- **Verificado:** bundle Android pelo Metro (`expo export`), sem nenhuma referência de
  autenticação/API Microsoft (só o nome de ícone `microsoft-onedrive` do pacote de ícones);
  testes de integração do `AppSession` (QR "Sou eu" com aprovação, "Sou outra pessoa",
  modo avião, segundo plano, reabrir offline); E2E com o app desktop real recebendo o
  lançamento feito no "celular" em modo avião ~200 ms depois de religar.
- **Não verificado em aparelho:** não havia Android/emulador nesta máquina. Falta testar no
  celular a câmera, o NetInfo e o AppState reais (o restante roda o mesmo código testado).
  Antes do build local, `npx expo prebuild --clean` (dependências nativas novas).

## Pronto quando

- Um lançamento feito no celular em modo avião aparece no desktop do outro membro assim que o
  celular volta a ter internet.
- O APK não contém nenhuma referência a OneDrive/Microsoft.

---

[[etapa-07-totalizacao-familia|← Etapa 7]] · [[README|Plano v2.0.0]] · [[etapa-09-migracao-dados|Etapa 9 →]]
