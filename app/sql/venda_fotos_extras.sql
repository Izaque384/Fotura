-- Venda de fotos extras — MVP
-- Adiciona configuração por galeria, conta Stripe conectada por fotógrafo e pedidos de compra.

alter table public.galerias
  add column if not exists venda_extras_ativa boolean not null default false,
  add column if not exists preco_foto_extra_centavos integer;

alter table public.galerias
  drop constraint if exists galerias_preco_foto_extra_centavos_check;
alter table public.galerias
  add constraint galerias_preco_foto_extra_centavos_check
  check (preco_foto_extra_centavos is null or preco_foto_extra_centavos >= 100);

alter table public.perfis
  add column if not exists stripe_conta_id text,
  add column if not exists stripe_recebimentos_ativo boolean not null default false,
  add column if not exists stripe_recebimentos_atualizado_em timestamptz;

create unique index if not exists perfis_stripe_conta_id_uidx
  on public.perfis(stripe_conta_id)
  where stripe_conta_id is not null;

create table if not exists public.vendas_fotos (
  id uuid primary key default gen_random_uuid(),
  galeria uuid not null references public.galerias(id) on delete cascade,
  fotografo_id uuid not null,
  fotos text[] not null default '{}',
  qtd_incluidas integer not null default 0,
  qtd_extras integer not null,
  valor_unitario_centavos integer not null,
  valor_total_centavos integer not null,
  moeda text not null default 'brl',
  status text not null default 'pendente',
  stripe_conta_id text not null,
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  criado_em timestamptz not null default now(),
  pago_em timestamptz,
  atualizado_em timestamptz not null default now(),
  constraint vendas_fotos_qtd_extras_check check (qtd_extras > 0),
  constraint vendas_fotos_valor_unitario_check check (valor_unitario_centavos >= 100),
  constraint vendas_fotos_valor_total_check check (valor_total_centavos > 0),
  constraint vendas_fotos_status_check check (status in ('pendente','pago','cancelado','falhou'))
);

create unique index if not exists vendas_fotos_checkout_uidx
  on public.vendas_fotos(stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;
create index if not exists vendas_fotos_galeria_idx on public.vendas_fotos(galeria, criado_em desc);
create index if not exists vendas_fotos_fotografo_idx on public.vendas_fotos(fotografo_id, criado_em desc);

alter table public.vendas_fotos enable row level security;

drop policy if exists "Fotografo ve proprias vendas" on public.vendas_fotos;
create policy "Fotografo ve proprias vendas"
on public.vendas_fotos
for select
to authenticated
using (fotografo_id = (select auth.uid()));

create or replace function public.configurar_venda_extras_galeria(
  p_galeria uuid,
  p_ativo boolean,
  p_preco_centavos integer
)
returns boolean
language plpgsql
security invoker
set search_path to ''
as $function$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Não autenticado.' using errcode='42501';
  end if;
  if coalesce(p_ativo,false) and coalesce(p_preco_centavos,0) < 100 then
    raise exception 'O preço por foto extra deve ser de pelo menos R$ 1,00.' using errcode='22023';
  end if;
  update public.galerias
     set venda_extras_ativa = coalesce(p_ativo,false),
         preco_foto_extra_centavos = case when coalesce(p_ativo,false) then p_preco_centavos else null end
   where id = p_galeria and user_id = v_uid;
  if not found then raise exception 'Galeria não encontrada.' using errcode='P0002'; end if;
  return true;
end;
$function$;

revoke all on function public.configurar_venda_extras_galeria(uuid,boolean,integer) from public;
revoke all on function public.configurar_venda_extras_galeria(uuid,boolean,integer) from anon;
grant execute on function public.configurar_venda_extras_galeria(uuid,boolean,integer) to authenticated;
