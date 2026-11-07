---
tags:
  - myfinances
  - plano/v2
  - etapa
aliases:
  - "Etapa 5"
  - "Autenticação e famílias"
etapa: 5
status: concluída
plano: "[[README|Plano v2.0.0]]"
depende_de:
  - "[[etapa-03-sincronizacao]]"
  - "[[etapa-04-conexao-byo]]"
---
# Etapa 5 — Autenticação e famílias

**Objetivo:** substituir o login local (nome + senha scrypt em `users`) pelo Supabase Auth e
introduzir família, membros e convites.

## Divisão do trabalho

Mesmo critério da Etapa 4: a lógica fica no core, testada contra o Supabase local (Auth,
RPCs e Edge Function reais). As telas e a remoção do login antigo entram quando cada app
passar a rodar sobre o core: Etapa 6 no desktop e Etapa 8 no mobile.

| Peça | Onde |
|---|---|
| Portas `AuthGateway`, `FamilyGateway`, `DeviceGateway`, `PairingFunction` | `packages/core/src/remote/gateways.ts` |
| Implementação sobre o supabase-js (sem importar o pacote em runtime) e mapa de erros | `packages/core/src/remote/supabaseGateway.ts` |
| Use cases de conta e sessão | `packages/core/src/use-cases/account.ts` |
| Use cases de família e convite | `packages/core/src/use-cases/families.ts` |
| Use cases do QR e dos aparelhos | `packages/core/src/use-cases/devices.ts` |
| Raiz de composição | `packages/core/src/createAccount.ts` |

## Tarefas

### Auth
- [x] Cadastro, login, logout (`scope: 'local'`: sai só deste aparelho) e "esqueci a
  senha". O nome vai em `options.data.name`.
- [x] Senha mínima de 6 (padrão do Supabase). Se o projeto exigir mais, o servidor recusa
  com a própria mensagem, mapeada para `VALIDATION`.
- [x] Projeto com "Confirm email" ligado: o cadastro avisa que é preciso confirmar
  (`NOT_AUTHENTICATED`, `reason: email_confirmation`).
- [x] Erros com código próprio: `INVALID_CREDENTIALS`, `EMAIL_IN_USE`, `OFFLINE`,
  `FORBIDDEN`, `INVITE_INVALID`, `PAIRING_*`.
- [x] Perfil: ler e editar `profiles` (nome, telefone, avatar) e trocar a senha.
- [ ] Remover `auth.service.ts`, `auth.ipc.ts`, `mobile/src/data/repositories/auth.ts`,
  `scripts/reset-password.mjs` e o `scrypt-js` → Etapas 6 e 8 (os apps ainda usam).

### Uso offline
- [x] `AccountSession.resume()` usa a sessão guardada no store seguro (chave fixa
  `myfinances.auth`), mesmo sem rede e com o token expirado. A lista de famílias vem do
  SQLite local.
- [x] Abrir offline é rápido: com `online: false` não tenta a rede, e sem esse aviso a
  tentativa tem limite de 4 s. O supabase-js repete GETs que falham por rede e, sem o
  limite, isso levava 7 s.
- [x] Sair com pendências no outbox exige `force` (`CONFLICT` com a contagem).
- [ ] UI desabilita criar família e aceitar convite offline → Etapas 6 e 8.

### Família
- [x] `CreateFamily`: RPC, seleciona a família e cria as 18 categorias padrão (que sobem no
  próximo sync).
- [x] `JoinFamily`: aceita o código `mf1.` (do QR ou colado) ou só o token. Recusa o
  código de outro banco (`INVALID_CONNECTION`, `reason: other_project`).
- [x] `CreateFamilyInvite`: gera o código de convite completo (URL + key + família +
  quem convidou + token).
- [x] Várias famílias, com a ativa salva por aparelho e usuário (`ActiveFamilyStore`).
- [x] Membros: listar (banco local), desativar e reativar.
- [ ] Telas (seletor, Membros, Convidar com QR, onboarding com "Importar da v1") →
  Etapas 6 e 8.

### Conectar celular por QR Code
- [x] `CreateDeviceLink` (QR com pareamento e, se OWNER/ADMIN, convite),
  `ListPendingPairings`, `ResolvePairing`, `ScanDeviceLink`, `WaitPairingApproval` (a
  cada 2 s, com cancelamento), `CompletePairing`, `RegisterDevice`, `ListDevices`
  (marca o aparelho atual) e `RevokeDevice`.
- [x] Fallback sem a Edge Function: "Sou eu" vira login com o e-mail preenchido.
- [x] Validações da Etapa 1 confirmadas: `generateLink` + `verifyOtp`, claim `session_id` e
  `revoke_device`.
- [ ] Telas (QR com contagem regressiva, diálogo "Permitir" via Realtime, Aparelhos
  conectados, leitor de QR) → Etapas 6 e 8.

### Testes
- [x] 16 casos de integração (`tests/account.integration.ts`), com `yarn functions:serve`
  rodando:
  - cadastro;
  - erros de cadastro e login;
  - perfil;
  - reabrir offline;
  - sair com pendências;
  - família com categorias padrão vista igual pelo convidado;
  - não convidado não vê nada;
  - convite usado, de outro banco ou só token reaproveitado;
  - **convite aceito ao mesmo tempo por duas pessoas** (só uma entra; pendência da Etapa 1);
  - permissões de OWNER/MEMBER;
  - várias famílias;
  - "Sou eu" completo até sincronizar e desconectar;
  - "Sou eu" negado;
  - "Sou outra pessoa";
  - QR de MEMBER sem convite;
  - fallback sem a função.

## Fluxo de entrada de um membro novo

**Principal (presencial):** no computador, Perfil → **Conectar celular**. No celular da
pessoa: **Ler QR Code** → **Sou outra pessoa da família** → criar conta → já cai no dashboard
da família.

**À distância:** o OWNER/ADMIN gera em **Membros → Convidar** um código de convite (validade
de 7 dias, uso único) e manda pelo WhatsApp. A pessoa escolhe "Entrar com código de convite",
cola o código, cria a conta, e o app chama `accept_family_invite` automaticamente.

## Pronto quando

- Dois usuários no mesmo projeto, na mesma família, enxergam os mesmos cadastros.
- Um terceiro usuário sem convite não enxerga nada.
- Um convite usado não funciona de novo.
- No celular, ler o QR e escolher "Sou eu" + Permitir no computador deixa o app logado e
  sincronizando sem digitar nada. Ler o mesmo QR num segundo celular falha.
- Desconectar um aparelho em "Aparelhos conectados" o desloga em até 1 h.

---

[[etapa-04-conexao-byo|← Etapa 4]] · [[README|Plano v2.0.0]] · [[etapa-06-desktop|Etapa 6 →]]
