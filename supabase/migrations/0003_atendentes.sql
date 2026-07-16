-- Iza Travel — filtro por atendente (usuário do Chatvolt)
-- Rode no Supabase: SQL Editor → New query → cole → Run.

-- Nomes dos atendentes (membros do Chatvolt) que atenderam a conversa.
alter table conversations add column if not exists atendentes text[] default '{}';

-- Índice para filtrar por atendente (contém).
create index if not exists idx_conversations_atendentes on conversations using gin (atendentes);
