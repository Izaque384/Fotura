-- Garante a regra de produto: pastas de um Projeto nunca possuem capa própria.
create or replace function public.bloquear_capa_individual_pasta()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if new.projeto_id is not null then
    new.capa := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_bloquear_capa_individual_pasta on public.galerias;
create trigger trg_bloquear_capa_individual_pasta
before insert or update of capa, projeto_id
on public.galerias
for each row execute function public.bloquear_capa_individual_pasta();

revoke all on function public.bloquear_capa_individual_pasta() from public, anon, authenticated;
grant execute on function public.bloquear_capa_individual_pasta() to service_role;
