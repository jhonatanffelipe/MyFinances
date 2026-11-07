---
tags:
  - myfinances
  - plano/v2
  - etapa
aliases:
  - "Etapa 7"
  - "Totalização da família"
etapa: 7
status: pendente
plano: "[[README|Plano v2.0.0]]"
depende_de:
  - "[[etapa-06-desktop]]"
---
# Etapa 7 — Totalização da família

**Objetivo:** a funcionalidade central pedida. Saldo, receitas, despesas e gráficos somam
todos os membros da família, com a opção de ver um membro só.

## Tarefas

- [ ] **Totais calculados no SQLite local**, para o dashboard funcionar offline e refletir na
  hora o que acabou de ser lançado. `GetDashboard` no core reimplementa em SQL do SQLite a
  mesma regra de [[sql/003_rpc.sql|sql/003_rpc.sql]] (que fica como especificação de
  referência e não é chamada pelo app). Todas as consultas filtram `deleted_at IS NULL`.
- [ ] Trocar o loop de 5 consultas do histórico mensal (`dashboard.ipc.ts`) por uma consulta
  agrupada por `strftime('%Y-%m', date)`.
- [ ] Índices locais: `(family_id, date)`, `(family_id, member_id, date)`,
  `(family_id, to_member_id)`.
- [ ] Testes: família com 2 membros, totais da família = soma dos individuais.
- [ ] **Seletor de visão** no topo do dashboard: `Família` (padrão) | `Eu` | `<membro>`. O
  mesmo filtro vale para Lançamentos.
- [ ] **Novo card/gráfico "Por membro"**: receita × despesa de cada membro no mês (campo
  `byMember` da RPC).
- [ ] KPIs (`KpiCards`) mostram o rótulo da visão ativa ("Saldo da família" / "Seu saldo").
- [ ] Despesas fixas: total da família, com o responsável (`member_id`) exibido na lista
  `UpcomingFixedExpensesList`.
- [ ] Limite mensal de categoria (`monthly_limit`) passa a considerar o consumo da família
  inteira.
- [ ] **Tempo real:** o Realtime (`postgres_changes` com `filter: family_id=eq.<id>`) só
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

## Pronto quando

- Com 2 membros lançando, o dashboard "Família" bate com a soma manual, e "Eu" mostra só os
  próprios lançamentos.

---

[[etapa-06-desktop|← Etapa 6]] · [[README|Plano v2.0.0]] · [[etapa-08-mobile|Etapa 8 →]]
