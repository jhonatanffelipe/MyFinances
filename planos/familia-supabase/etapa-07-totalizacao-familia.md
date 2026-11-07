---
tags:
  - myfinances
  - plano/v2
  - etapa
aliases:
  - "Etapa 7"
  - "Totalização da família"
etapa: 7
status: concluída
plano: "[[README|Plano v2.0.0]]"
depende_de:
  - "[[etapa-06-desktop]]"
---
# Etapa 7 — Totalização da família

**Objetivo:** a funcionalidade central pedida. Saldo, receitas, despesas e gráficos somam
todos os membros da família, com a opção de ver um membro só.

## Tarefas

- [x] **Totais calculados no SQLite local**, para o dashboard funcionar offline e refletir na
  hora o que acabou de ser lançado. `GetDashboard` no core reimplementa em SQL do SQLite a
  mesma regra de `supabase/migrations/20261107000005_dashboard.sql` (que fica como especificação de
  referência e não é chamada pelo app). Todas as consultas filtram `deleted_at IS NULL`.
- [x] Trocar o loop de 5 consultas do histórico mensal (`dashboard.ipc.ts`) por uma consulta
  agrupada por `strftime('%Y-%m', date)`.
- [x] Índices locais: `(family_id, date)`, `(family_id, member_id, date)`,
  `(family_id, to_member_id)`.
- [x] Testes: família com 2 membros, totais da família = soma dos individuais.
- [x] **Seletor de visão** no topo do dashboard: `Família` (padrão) | `Eu` | `<membro>`. O
  mesmo filtro vale para Lançamentos.
- [x] **Novo card/gráfico "Por membro"**: receita × despesa de cada membro no mês (campo
  `byMember` da RPC).
- [x] KPIs (`KpiCards`) mostram o rótulo da visão ativa ("Saldo da família" / "Seu saldo").
- [x] Despesas fixas: total da família, com o responsável (`member_id`) exibido na lista
  `UpcomingFixedExpensesList`.
- [x] Limite mensal de categoria (`monthly_limit`) passa a considerar o consumo da família
  inteira.
- [x] **Tempo real:** o Realtime (`postgres_changes` com `filter: family_id=eq.<id>`) só
  **acorda** o `SyncEngine` para um pull. Ao terminar o pull, o core emite
  `data-changed { tables }` e as telas recarregam do SQLite local. Usar debounce de ~500 ms para
  importações em lote não dispararem dezenas de recargas. Trocar de família cancela a
  assinatura anterior.

## Transferências entre membros

Exemplo: o pai dá R$ 200 de mesada ao filho. Registrar isso como despesa do pai e receita do
filho inflaria os totais da família, que aparentaria ganhar e gastar R$ 200 a mais.

- Registro: `type = 'TRANSFER'`, `member_id` = quem envia, `to_member_id` = quem recebe, sem
  categoria (garantido pela constraint `movements_transfer_chk`).
- **Visão Família:** ignorada em receita, despesa, saldo e gráficos.
- **Visão de um membro:** entra no saldo (saída para quem envia, entrada para quem recebe) e
  aparece separada em `transferIn`/`transferOut`. Não soma em receita/despesa do mês nem nos
  gráficos por categoria/cartão.
- Testes: uma família com transferência tem o mesmo saldo consolidado que a mesma família
  sem ela, e a soma dos saldos individuais é igual ao saldo da família.

## Como ficou (2026-11-07)

- **Core:** `GetDashboard.execute(yearMonth, { memberId })` com a regra do `005_dashboard.sql`
  no SQLite local (`DashboardScope`); devolve `view`, `transferIn`/`transferOut` e `byMember`.
  O histórico mensal é uma consulta agrupada por `substr(date, 1, 7)` e o histórico de fixos
  sai de uma leitura só (antes: 5 + 12 consultas). Migração local v2 com o índice
  `(family_id, to_member_id)`; `(family_id, date)` e `(family_id, member_id, date)` já existiam.
- **Membros no tempo real:** o `sync_pull` manda a lista de membros em todo pull; o
  `SyncEngine` compara com o SQLite local e só reporta `members`/`families` em
  `onRemoteChange` quando mudam (antes, um membro novo não atualizava a tela).
- **Desktop:** seletor `Família | Eu | <membro>` compartilhado com o filtro "Membro" de
  Lançamentos (volta para Família ao trocar de família); KPIs com o rótulo da visão e tendência
  com cor/seta corretas; aviso de transferências na visão de membro; card "Por membro";
  "Despesas fixas do mês" com o responsável. `data-changed` com debounce de 500 ms e as tabelas
  tocadas.
- **Verificado:** 5 testes novos no core (família = soma dos membros; transferência não muda a
  família; byMember; membro alheio recusado; limite de categoria da família) e E2E com duas
  instâncias do app (Ana e Beto): totais conferidos à mão, Beto vê os mesmos totais e os
  lançamentos do outro chegam por Realtime em ~1,5 s sem sincronizar manualmente.

## Pronto quando

- Com 2 membros lançando, o dashboard "Família" bate com a soma manual, e "Eu" mostra só os
  próprios lançamentos.

---

[[etapa-06-desktop|← Etapa 6]] · [[README|Plano v2.0.0]] · [[etapa-08-mobile|Etapa 8 →]]
