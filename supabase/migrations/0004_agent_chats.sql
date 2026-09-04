-- Iza Travel — memória do agente conversacional
-- Rode no Supabase: SQL Editor → New query → cole → Run.

-- Conversas do chat (uma por "thread" na lateral)
create table if not exists agent_chats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  title text not null default 'Nova conversa',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_agent_chats_user on agent_chats (user_id, updated_at desc);

-- Mensagens de cada conversa
create table if not exists agent_messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references agent_chats (id) on delete cascade,
  role text not null check (role in ('user', 'agent')),
  content text not null,
  tools jsonb,
  citations text[] default '{}',
  created_at timestamptz not null default now()
);
create index if not exists idx_agent_messages_chat on agent_messages (chat_id, created_at);

-- Aprendizados acumulados (contexto reaproveitado em novas conversas)
create table if not exists agent_learnings (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid references agent_chats (id) on delete set null,
  content text not null unique,
  created_at timestamptz not null default now()
);
create index if not exists idx_agent_learnings_recentes on agent_learnings (created_at desc);

-- Acesso apenas pelo backend (service_role ignora RLS); sem políticas = sem acesso direto do cliente.
alter table agent_chats enable row level security;
alter table agent_messages enable row level security;
alter table agent_learnings enable row level security;
