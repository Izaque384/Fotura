-- Modelos de organizacao para projetos novos. Registros historicos permanecem null.
alter table public.galeria_projetos add column if not exists modelo text null;
comment on column public.galeria_projetos.modelo is
  'Modelo de organizacao: ensaio=selecao unica, entrega=galeria unica, casamento=varias galerias; null=legado.';
do $$ begin
  if not exists (
    select 1 from pg_constraint where conname='galeria_projetos_modelo_check'
       and conrelid='public.galeria_projetos'::regclass
  ) then
    alter table public.galeria_projetos add constraint galeria_projetos_modelo_check
      check (modelo is null or modelo in ('ensaio','entrega','casamento'));
  end if;
end $$;
