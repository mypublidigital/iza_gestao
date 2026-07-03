-- ISA Travel — schema inicial (Fase 3)
-- Rode este arquivo no Supabase: SQL Editor → New query → cole → Run.
-- Idempotente: pode rodar mais de uma vez sem quebrar.

-- ---------- Extensões ----------
create extension if not exists vector;      -- busca semântica (pgvector)
create extension if not exists pgcrypto;    -- gen_random_uuid()

-- ---------- Enums ----------
do $$ begin
  create type resolutividade as enum ('sim', 'nao', 'parcial');
exception when duplicate_object then null; end $$;

do $$ begin
  create type sentimento as enum ('positivo', 'neutro', 'negativo');
exception when duplicate_object then null; end $$;

do $$ begin
  create type message_role as enum ('user', 'agent');
exception when duplicate_object then null; end $$;

-- ============================================================
-- raw_events — fonte da verdade, append-only
-- ============================================================
create table if not exists raw_events (
  id              uuid primary key default gen_random_uuid(),
  event_type      text not null,
  conversation_id text not null,
  message_id      text,
  payload         jsonb not null,
  auth_valid      boolean not null default true,
  received_at     timestamptz not null default now(),
  processed       boolean not null default false,
  processed_at    timestamptz,
  process_error   text
);

create index if not exists idx_raw_events_conversation on raw_events (conversation_id);
create index if not exists idx_raw_events_type on raw_events (event_type);
-- fila de processamento: só os não processados
create index if not exists idx_raw_events_unprocessed on raw_events (received_at) where not processed;
-- idempotência: mesmo message_id não entra duas vezes
create unique index if not exists uq_raw_events_message on raw_events (message_id) where message_id is not null;

-- ============================================================
-- conversations — uma linha por conversationId
-- ============================================================
create table if not exists conversations (
  conversation_id   text primary key,
  organization_id   text not null,
  agent_id          text,
  agent_name        text,
  channel           text,
  status            text,
  priority          text,
  is_ai_enabled     boolean default true,

  -- Dados do usuário (PII — acesso restrito via RLS)
  user_name         text,
  user_email        text,
  user_phone        text,

  -- Métricas
  first_message_at  timestamptz,
  last_message_at   timestamptz,
  message_count     integer default 0,
  frustration       numeric,
  summary           text,

  -- CTWA (origem de anúncio)
  ctwa_headline     text,
  ctwa_body         text,
  ctwa_source_url   text,
  ctwa_media_type   text,
  ctwa_clicked_at   timestamptz,

  -- Campos enriquecidos pelo Claude
  destino_principal text,
  destinos          text[] default '{}',
  assunto           text,
  resolvida         resolutividade,
  sentimento        sentimento,
  intencao_compra   text,
  enriched_at       timestamptz,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_conversations_last_msg on conversations (last_message_at desc);
create index if not exists idx_conversations_channel on conversations (channel);
create index if not exists idx_conversations_assunto on conversations (assunto);
create index if not exists idx_conversations_destino on conversations (destino_principal);

-- ============================================================
-- messages — uma linha por mensagem (+ embedding pgvector)
-- ============================================================
create table if not exists messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id text not null references conversations (conversation_id) on delete cascade,
  message_id      text,
  role            message_role not null,
  content         text not null,
  created_at      timestamptz not null default now(),
  embedding       vector(1024),   -- Voyage voyage-3
  embedded_at     timestamptz
);

create index if not exists idx_messages_conversation on messages (conversation_id);
create unique index if not exists uq_messages_message on messages (message_id) where message_id is not null;
-- busca semântica por similaridade de cosseno
create index if not exists idx_messages_embedding on messages
  using hnsw (embedding vector_cosine_ops);

-- ============================================================
-- nps_ratings
-- ============================================================
create table if not exists nps_ratings (
  id                uuid primary key default gen_random_uuid(),
  conversation_id   text not null references conversations (conversation_id) on delete cascade,
  rating            integer,
  comment           text,
  completion_reason text,
  completed_at      timestamptz
);

create index if not exists idx_nps_conversation on nps_ratings (conversation_id);

-- ============================================================
-- tags + conversation_tags
-- ============================================================
create table if not exists tags (
  id   uuid primary key default gen_random_uuid(),
  name text not null unique
);

create table if not exists conversation_tags (
  conversation_id text not null references conversations (conversation_id) on delete cascade,
  tag_id          uuid not null references tags (id) on delete cascade,
  primary key (conversation_id, tag_id)
);

-- ============================================================
-- updated_at automático em conversations
-- ============================================================
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end $$ language plpgsql;

drop trigger if exists trg_conversations_updated on conversations;
create trigger trg_conversations_updated
  before update on conversations
  for each row execute function set_updated_at();

-- ============================================================
-- RLS — acesso restrito (LGPD). Fase 7 adiciona as políticas de leitura por equipe.
-- O webhook e os jobs usam a service_role, que ignora RLS.
-- ============================================================
alter table raw_events        enable row level security;
alter table conversations     enable row level security;
alter table messages          enable row level security;
alter table nps_ratings       enable row level security;
alter table tags              enable row level security;
alter table conversation_tags enable row level security;

-- Leitura para usuários autenticados (equipe da ISA Travel).
-- Ajustaremos o escopo (ex.: esconder PII) na Fase 7.
do $$
declare t text;
begin
  foreach t in array array['conversations','messages','nps_ratings','tags','conversation_tags']
  loop
    execute format(
      'drop policy if exists "equipe le %1$s" on %1$s;
       create policy "equipe le %1$s" on %1$s for select to authenticated using (true);',
      t
    );
  end loop;
end $$;
