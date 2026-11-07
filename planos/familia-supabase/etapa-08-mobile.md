---
tags:
  - myfinances
  - plano/v2
  - etapa
aliases:
  - "Etapa 8"
  - "Mobile local-first"
etapa: 8
status: pendente
plano: "[[README|Plano v2.0.0]]"
depende_de:
  - "[[etapa-05-auth-familias]]"
---
# Etapa 8 — Mobile local-first

**Objetivo:** o app Android passa a usar o core (expo-sqlite + sincronização com o
Supabase), sem OneDrive. Pode rodar em paralelo às Etapas 6–7, depois da 5.

## Tarefas

- [ ] Client supabase-js com sessão no `expo-secure-store`. A sessão pode passar do limite de
  ~2 KB por chave, então usar um adapter que guarda uma chave de cifra no SecureStore e o dado
  cifrado no armazenamento comum.
- [ ] `AppState`: em foreground, `startAutoRefresh()` + pull + reassina o Realtime; em
  background, `stopAutoRefresh()` + flush do outbox + pausa o Realtime.
- [ ] Monitor de rede com `@react-native-community/netinfo` para o `SyncEngine`.
- [ ] Trocar `mobile/src/hooks/useData.ts` e `mobile/src/data/repositories/*` pelos do core.
  Os repositórios saem do mobile, mas o `expoAdapter` continua (agora vindo do core).
- [ ] Primeira tela com **Ler QR Code** como ação principal (`expo-camera` para ler o
  código) e "Conectar manualmente" como alternativa. Telas "Quem vai usar este celular?",
  "Confirme no computador" e mensagens de expirado/recusado/já usado, conforme o
  [[fluxo-conectar-celular|fluxo de conexão do celular]].
- [ ] Nome do aparelho para o pedido de aprovação via `expo-device` (já é dependência), por
  exemplo "Moto G (Android)".
- [ ] Telas novas/ajustadas: seletor de família,
  filtro por membro, campo "De quem", tipo Transferência e tela de pendências de sync.
- [ ] `SyncBanner` passa a mostrar o status do `SyncEngine` (offline / N pendentes / erro).
- [ ] Remover: `mobile/src/sync/*` (Graph, msAuth, presence, syncManager), `SyncContext` antigo,
  `MicrosoftLoginModal`, `app/sync.tsx`, o `microsoftClientId` do `app.json` e as dependências
  `expo-auth-session` e `react-native-webview` (se não forem mais usadas). O `expo-sqlite`
  **fica**.
- [ ] Migrar `mobile/tests` para o core.

## Pronto quando

- Um lançamento feito no celular em modo avião aparece no desktop do outro membro assim que o
  celular volta a ter internet.
- O APK não contém nenhuma referência a OneDrive/Microsoft.

---

[[etapa-07-totalizacao-familia|← Etapa 7]] · [[README|Plano v2.0.0]] · [[etapa-09-migracao-dados|Etapa 9 →]]
