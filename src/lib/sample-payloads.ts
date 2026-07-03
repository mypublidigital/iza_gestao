// Payloads de exemplo dos principais eventos do Chatvolt — usados pelo simulador
// para testar a ingestão sem depender do Chatvolt real.

import type { EventType } from "@/lib/types";

export interface SamplePayload {
  eventType: EventType;
  label: string;
  payload: Record<string, unknown>;
}

// Timestamp fixo para exibição estável (evita hydration mismatch).
// O simulador injeta a hora real no momento do envio.
const SAMPLE_TS = "2026-06-19T12:00:00.000Z";

const base = {
  conversationId: "conv_sim_001",
  agentId: "agt_isa",
  agentName: "ISA (IA)",
  channel: "whatsapp",
  conversationStatus: "aberta",
  conversationPriority: "media",
  isAiEnabled: true,
  organizationId: "org_isatravel",
};

export const SAMPLE_PAYLOADS: SamplePayload[] = [
  {
    eventType: "AGENT_USER_MESSAGE",
    label: "Usuário pergunta e IA responde (evento padrão)",
    payload: {
      ...base,
      eventType: "AGENT_USER_MESSAGE",
      messageId: "wamid_sim_001",
      userMessage: "Oi! Quanto custa um pacote para as Maldivas em setembro?",
      agentResponse:
        "Olá! Para as Maldivas em setembro temos pacotes a partir de R$ 12.500 por pessoa com aéreo + resort. Quer que eu detalhe?",
      userName: "Mariana Souza",
      userPhoneNumber: "+55 11 98888-1234",
      summary: "Cliente pede cotação de pacote para as Maldivas em setembro.",
      frustration: 0.1,
      tags: ["lua-de-mel"],
      createdAt: SAMPLE_TS,
    },
  },
  {
    eventType: "USER_MESSAGE_RECEIVED",
    label: "Mensagem do usuário com IA desativada",
    payload: {
      ...base,
      eventType: "USER_MESSAGE_RECEIVED",
      isAiEnabled: false,
      messageId: "wamid_sim_002",
      userMessage: "Preciso falar com um atendente humano, por favor.",
      userName: "Carlos Henrique Lima",
      createdAt: SAMPLE_TS,
    },
  },
  {
    eventType: "NPS_INTERACTION",
    label: "Cliente respondeu o NPS",
    payload: {
      ...base,
      eventType: "NPS_INTERACTION",
      rating: 9,
      comment: "Atendimento rápido e atencioso!",
      completionReason: "fluxo_concluido",
      completedAt: SAMPLE_TS,
    },
  },
  {
    eventType: "AGENT_MESSAGE_SENDED",
    label: "Agente humano respondeu (Inbox)",
    payload: {
      ...base,
      eventType: "AGENT_MESSAGE_SENDED",
      isAiEnabled: false,
      agentName: "Lia (humano)",
      messageId: "wamid_sim_003",
      agentResponse: "Olá, sou a Lia da ISA Travel. Vou te ajudar com a alteração da sua reserva.",
      createdAt: SAMPLE_TS,
    },
  },
  {
    eventType: "AGENT_MESSAGE_BLOCKED",
    label: "Mensagem bloqueada (fora da janela 24h)",
    payload: {
      ...base,
      eventType: "AGENT_MESSAGE_BLOCKED",
      messageId: "wamid_sim_004",
      agentResponse: "(mensagem não entregue — fora da janela de 24h do WhatsApp)",
      createdAt: SAMPLE_TS,
    },
  },
];
