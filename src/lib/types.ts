// Tipos de domínio da plataforma ISA Travel.
// Espelham o modelo de dados aprovado (Supabase/Postgres) e o payload do webhook do Chatvolt.
// Na fase local-first são preenchidos por dados mockados; depois virão do Supabase sem mudar as telas.

export type EventType =
  | "USER_MESSAGE_RECEIVED"
  | "AGENT_MESSAGE_SENDED"
  | "AGENT_USER_MESSAGE"
  | "AGENT_MESSAGE_FOLLOW_UP"
  | "AGENT_MESSAGE_BLOCKED"
  | "AGENT_MESSAGE_NOTED"
  | "GROUP_MESSAGE_RECEIVED"
  | "STEP_ENTERED"
  | "NPS_INTERACTION";

export type Canal = "whatsapp" | "instagram" | "webchat" | "telegram" | "zapi";

export type ConversationStatus = "aberta" | "resolvida" | "pendente" | "transferida";

export type Prioridade = "baixa" | "media" | "alta";

export type Resolutividade = "sim" | "nao" | "parcial";

export type Sentimento = "positivo" | "neutro" | "negativo";

/** Sinal de intenção de compra detectado no enriquecimento (KPI #13). */
export type IntencaoCompra = "alta" | "media" | "baixa" | "nenhuma";

export type MessageRole = "user" | "agent";

export interface Message {
  id: string;
  conversationId: string;
  messageId: string;
  role: MessageRole;
  content: string;
  createdAt: string; // ISO
}

export interface NpsRating {
  id: string;
  conversationId: string;
  rating: number; // 0..10
  comment?: string;
  completionReason?: string;
  completedAt: string; // ISO
}

export interface CtwaAttribution {
  headline: string;
  body?: string;
  sourceUrl?: string;
  mediaType?: string;
  clickedAt?: string;
}

export interface Conversation {
  conversationId: string;
  organizationId: string;
  agentId: string;
  agentName: string;
  channel: Canal;
  status: ConversationStatus;
  priority: Prioridade;
  isAiEnabled: boolean;

  // Dados do usuário (PII — acesso restrito em produção)
  userName?: string;
  userEmail?: string;
  userPhone?: string;

  // Métricas
  firstMessageAt: string; // ISO
  lastMessageAt: string; // ISO
  messageCount: number;
  frustration: number; // 0..1
  summary?: string;

  // CTWA (origem de anúncio)
  ctwa?: CtwaAttribution;

  // Campos enriquecidos pelo Claude
  destinoPrincipal?: string;
  destinos: string[];
  assunto: string;
  resolvida: Resolutividade;
  sentimento: Sentimento;
  intencaoCompra: IntencaoCompra;
  enrichedAt?: string;

  tags: string[];
  atendentes: string[]; // membros do Chatvolt que atenderam (assignees + quem respondeu)

  // Mensagens da conversa (no banco vivem em `messages`)
  messages: Message[];
  nps?: NpsRating;
}

export interface RawEvent {
  id: string;
  eventType: EventType;
  conversationId: string;
  messageId?: string;
  payload: Record<string, unknown>;
  authValid: boolean;
  receivedAt: string; // ISO
  processed: boolean;
  processedAt?: string;
  processError?: string;
}

// ---- Tipos derivados para o dashboard ----

export interface DashboardFilters {
  from?: string; // ISO date
  to?: string; // ISO date
  channel?: Canal | "todos";
  tag?: string | "todas";
  atendente?: string | "todos";
}

export interface KpiSummary {
  totalConversas: number;
  npsMedio: number;
  taxaResolucao: number; // 0..1
  taxaTransferencia: number; // 0..1
  frustrationMedia: number; // 0..1
  duracaoMediaMin: number;
  mensagensPorConversa: number;
}

export interface DestinoRanking {
  destino: string;
  total: number;
  variacao: number; // % vs período anterior
}

export interface AssuntoDist {
  assunto: string;
  total: number;
}

export interface HeatmapCell {
  dia: number; // 0=Dom .. 6=Sáb
  hora: number; // 0..23
  total: number;
}

export interface SerieTemporal {
  data: string; // YYYY-MM-DD
  total: number;
  sentimentoMedio: number; // -1..1
}

export interface NpsDist {
  promotores: number;
  neutros: number;
  detratores: number;
  media: number;
}

export interface CanalDist {
  canal: Canal;
  total: number;
}

export interface ResolucaoDist {
  resolvidas: number;
  parciais: number;
  naoResolvidas: number;
}

export interface CtwaPerformance {
  anuncio: string;
  conversas: number;
  npsMedio: number;
  intencaoAltaPct: number;
}

export interface DuvidaNaoResolvida {
  conversationId: string;
  assunto: string;
  resumo: string;
  destino?: string;
}
