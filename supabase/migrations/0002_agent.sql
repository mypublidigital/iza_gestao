-- ISA Travel — Fase 5 (agente conversacional)
-- Função de consulta SOMENTE-LEITURA usada pela ferramenta query_database do agente.
-- Rode no Supabase: SQL Editor → New query → cole → Run.
--
-- Segurança: só aceita 1 instrução SELECT/WITH; bloqueia DML/DDL; limita a 500 linhas;
-- timeout de 5s. Chamada apenas pelo backend (service_role).

create or replace function agent_query(query_text text)
returns jsonb
language plpgsql
security definer
set search_path = public
set statement_timeout = '5000'
as $$
declare
  result jsonb;
  lowered text := lower(btrim(query_text));
begin
  -- Precisa começar com SELECT ou WITH.
  if left(lowered, 6) <> 'select' and left(lowered, 4) <> 'with' then
    raise exception 'Apenas consultas SELECT são permitidas';
  end if;

  -- Bloqueia comandos de escrita/estrutura e múltiplas instruções.
  if lowered ~ '(\minsert\M|\mupdate\M|\mdelete\M|\mdrop\M|\malter\M|\mtruncate\M|\mgrant\M|\mrevoke\M|\mcreate\M|;\s*\S)' then
    raise exception 'Consulta não permitida';
  end if;

  -- Executa encapsulando: limita a 500 linhas e agrega em JSON.
  execute format(
    'select coalesce(jsonb_agg(t), ''[]''::jsonb) from (select * from (%s) sub limit 500) t',
    query_text
  ) into result;

  return result;
end;
$$;

grant execute on function agent_query(text) to service_role;
