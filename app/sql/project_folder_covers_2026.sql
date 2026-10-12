-- Pastas podem ter capa própria; a capa do projeto continua como fallback.
-- Aplicar após project_shared_cover_guard_2026.sql.
drop trigger if exists trg_bloquear_capa_individual_pasta on public.galerias;
