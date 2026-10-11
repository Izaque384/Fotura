-- Restringe funções internas da arquitetura de Projetos.
revoke all on function public.aplicar_config_projeto_na_pasta() from public, anon, authenticated;
revoke all on function public.sincronizar_config_pastas_projeto() from public, anon, authenticated;
grant execute on function public.aplicar_config_projeto_na_pasta() to service_role;
grant execute on function public.sincronizar_config_pastas_projeto() to service_role;

revoke all on function public.verificar_senha_projeto(uuid,text) from public, anon, authenticated;
grant execute on function public.verificar_senha_projeto(uuid,text) to service_role;
