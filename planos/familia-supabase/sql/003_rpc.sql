-- =====================================================================
-- MyFinances · 003_rpc.sql  (RASCUNHO — validar na Etapa 6)
-- Agregações do dashboard. SECURITY INVOKER: o RLS de movements continua
-- valendo, então a função nunca devolve dados de família alheia.
--
-- p_member_id NULL = visão consolidada da família.
--
-- Regra das TRANSFERÊNCIAS (type = 'TRANSFER', member_id -> to_member_id):
--   * Visão família: ignoradas (o dinheiro não saiu da família).
--   * Visão de um membro: saída para quem envia, entrada para quem recebe.
--     Aparecem em transferOut/transferIn e entram no saldo, mas NÃO somam em
--     monthIncome/monthExpense nem nos gráficos por categoria/cartão.
-- =====================================================================

create or replace function public.dashboard_summary(
  p_family_id uuid,
  p_start     date,
  p_end       date,
  p_member_id uuid default null
) returns jsonb
language sql stable security invoker set search_path = '' as $$
  with scoped as (
    -- Valor assinado do ponto de vista da visão escolhida
    select m.*,
           case
             when m.type = 'INCOME'  then  m.amount
             when m.type = 'EXPENSE' then -m.amount
             when p_member_id is null then 0                         -- transferência interna à família
             when m.member_id    = p_member_id then -m.amount        -- enviou
             when m.to_member_id = p_member_id then  m.amount        -- recebeu
             else 0
           end as signed_amount
    from public.movements m
    where m.family_id = p_family_id
      and (p_member_id is null
           or m.member_id = p_member_id
           or (m.type = 'TRANSFER' and m.to_member_id = p_member_id))
  ),
  period as (
    select * from scoped where date between p_start and p_end
  )
  select jsonb_build_object(
    'totalBalance', coalesce((select sum(signed_amount) from scoped where date <= p_end), 0),
    'monthIncome',  coalesce((select sum(amount) from period where type = 'INCOME'), 0),
    'monthExpense', coalesce((select sum(amount) from period where type = 'EXPENSE'), 0),
    'transferIn',   coalesce((select sum(signed_amount) from period where type = 'TRANSFER' and signed_amount > 0), 0),
    'transferOut',  coalesce((select -sum(signed_amount) from period where type = 'TRANSFER' and signed_amount < 0), 0),
    'expensesByCategory', coalesce((
      select jsonb_agg(x order by x.value desc) from (
        select c.id, c.name as label, coalesce(c.color, '#94a3b8') as color, sum(p.amount) as value
        from period p join public.categories c on c.family_id = p.family_id and c.id = p.category_id
        where p.type = 'EXPENSE'
        group by c.id, c.name, c.color) x), '[]'::jsonb),
    'expensesByCard', coalesce((
      select jsonb_agg(x order by x.value desc) from (
        select cc.id, cc.description as label, cc.color, sum(p.amount) as value
        from period p join public.credit_cards cc on cc.family_id = p.family_id and cc.id = p.credit_card_id
        where p.type = 'EXPENSE'
        group by cc.id, cc.description, cc.color) x), '[]'::jsonb),
    -- Receita x despesa de cada membro no período (sempre da família toda, sem transferências)
    'byMember', coalesce((
      select jsonb_agg(x order by x.expense desc) from (
        select mv.member_id, pr.name,
               sum(case when mv.type = 'INCOME'  then mv.amount else 0 end) as income,
               sum(case when mv.type = 'EXPENSE' then mv.amount else 0 end) as expense
        from public.movements mv join public.profiles pr on pr.id = mv.member_id
        where mv.family_id = p_family_id and mv.type <> 'TRANSFER'
          and mv.date between p_start and p_end
        group by mv.member_id, pr.name) x), '[]'::jsonb)
  );
$$;

-- Histórico mensal (substitui o loop de 5 queries do dashboard.ipc.ts).
-- Transferências não entram em receita/despesa (aparecem só no saldo do membro).
create or replace function public.monthly_history(
  p_family_id uuid,
  p_ref       date,
  p_months    int default 5,
  p_member_id uuid default null
) returns table (year_month text, income numeric, expense numeric)
language sql stable security invoker set search_path = '' as $$
  with months as (
    select generate_series(
      date_trunc('month', p_ref) - make_interval(months => p_months - 1),
      date_trunc('month', p_ref),
      interval '1 month')::date as m
  )
  select to_char(months.m, 'YYYY-MM'),
         coalesce(sum(mv.amount) filter (where mv.type = 'INCOME'), 0),
         coalesce(sum(mv.amount) filter (where mv.type = 'EXPENSE'), 0)
  from months
  left join public.movements mv
    on mv.family_id = p_family_id
   and mv.type <> 'TRANSFER'
   and mv.date >= months.m and mv.date < (months.m + interval '1 month')
   and (p_member_id is null or mv.member_id = p_member_id)
  group by months.m
  order by months.m;
$$;

grant execute on function public.dashboard_summary(uuid, date, date, uuid) to authenticated;
grant execute on function public.monthly_history(uuid, date, int, uuid)    to authenticated;
