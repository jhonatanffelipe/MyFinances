---
tags:
  - myfinances
  - plano/v2
  - etapa
aliases:
  - "Etapa 5"
  - "Autenticação e famílias"
etapa: 5
status: pendente
plano: "[[README|Plano v2.0.0]]"
depende_de:
  - "[[etapa-03-sincronizacao]]"
  - "[[etapa-04-conexao-byo]]"
---
# Etapa 5 — Autenticação e famílias

**Objetivo:** substituir o login local (nome + senha scrypt em `users`) pelo Supabase Auth e
introduzir família, membros e convites.

## Tarefas

### Auth
- [ ] Cadastro (nome, e-mail, senha), login, logout e "esqueci a senha" via Supabase Auth. O
  nome vai em `options.data.name`, e o trigger `handle_new_user` cria o `profiles`.
- [ ] Senha mínima: o Supabase usa 6 por padrão (hoje o app aceita 4). Ajustar a validação
  da UI para seguir a configuração do projeto.
- [ ] Remover `desktop/electron/services/auth.service.ts`, `auth.ipc.ts` (versão SQL),
  `mobile/src/data/repositories/auth.ts`, `scripts/reset-password.mjs` e a dependência
  `scrypt-js` do mobile.
- [ ] Tela de Perfil passa a editar `profiles` (nome, telefone, avatar) e e-mail/senha pelo Auth.

### Uso offline
- [ ] O primeiro login num dispositivo exige internet (cria a sessão e faz a carga inicial).
- [ ] Depois disso, abrir o app offline usa a sessão salva e o SQLite local, mesmo com o
  access token expirado. O refresh acontece quando a rede volta. Se o refresh falhar por
  sessão revogada, o app mantém o outbox, pede login de novo e só então sincroniza.
- [ ] Criar família e aceitar convite exigem internet (são RPCs). A UI desabilita essas ações
  offline com explicação.

### Família
- [ ] Logo após criar a família, o onboarding oferece **"Importar meu banco da v1"** ou
  **"Começar do zero"** (a importação está detalhada na Etapa 9).
- [ ] Depois do login, sem família: tela "Criar família" (`rpc('create_family')`) ou "Tenho
  convite" (`rpc('accept_family_invite')`).
- [ ] Usuário já com família pode **criar outra** ou **aceitar convite de outra** pelo menu
  do seletor.
- [ ] Com uma ou mais famílias: **seletor de família** no topo do layout (desktop:
  `AppLayout`; mobile: header das tabs). A família ativa fica salva por dispositivo.
- [ ] `FamilyContext` (desktop e mobile) expõe `familyId`, `role` e `members`, e os use cases
  recebem isso.
- [ ] Tela **Membros** (OWNER/ADMIN):
  - listar membros com papel;
  - **Convidar**: gera token via `rpc('create_family_invite')` e mostra o **código de
    conexão** completo (URL + key + token) para copiar, com QR. Validade de 7 dias e uso único;
  - desativar ou reativar membro (`rpc('set_member_active')`). O histórico do membro continua
    somando na família.
- [ ] Mensagens para os erros das RPCs: `invalid_or_expired_invite`, `forbidden`,
  `cannot_change_self`.

### Conectar celular por QR Code (pareamento + convite)
Especificação completa: [[fluxo-conectar-celular|Conectar celular por QR]].
- [ ] Aplicar `supabase/migrations/20261107000004_device_link.sql`: `device_pairings`,
  `user_devices`, `create_device_link`, `resolve_device_pairing`, `register_device` e
  `revoke_device`.
- [ ] Edge Function `pair-device` em `supabase/functions/`,
  publicada com `--no-verify-jwt`; ações `ping`, `scan` e `status`.
- [ ] Use cases no core: `CreateDeviceLink` (computador), `ScanDeviceLink` /
  `WaitPairingApproval` / `CompletePairing` (celular), `ResolvePairing`, `RegisterDevice`,
  `ListDevices`, `RevokeDevice`.
- [ ] **Caminho "Sou eu":** `scan` → aguarda aprovação (polling de 2 s, até expirar) →
  `verifyOtp({ token_hash, type: 'email' })` → `register_device` → carga inicial.
- [ ] **Caminho "Sou outra pessoa":** criar conta ou fazer login → `accept_family_invite(invite)`
  → carga inicial. Se o QR não tem `invite` (quem gerou não é OWNER/ADMIN), essa opção não
  aparece.
- [ ] **Fallback sem Edge Function** (`ping` responde 404): "Sou eu" vira login com o e-mail
  preenchido.
- [ ] Todo aparelho chama `register_device` após o login (inclusive o computador), para
  aparecer em **Perfil → Aparelhos conectados**, com a opção de desconectar.
- [ ] Validar na Etapa 1: `generateLink({ type: 'magiclink' })` + `verifyOtp` com
  `type: 'email'` cria sessão sem enviar e-mail; `auth.jwt() ->> 'session_id'` existe no JWT;
  `delete from auth.sessions` derruba o refresh do aparelho.

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
