// Dataset mockado da ISA Travel para a fase local-first.
// Gerado de forma determinística (seed fixa) para que dashboard e gráficos fiquem estáveis entre reloads.
// Em produção, esta camada é substituída por queries no Supabase — as telas não mudam.

import type {
  Canal,
  Conversation,
  IntencaoCompra,
  Message,
  NpsRating,
  RawEvent,
  Resolutividade,
  Sentimento,
} from "@/lib/types";

// ---- PRNG determinístico (mulberry32) ----
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(20260619);
const pick = <T,>(arr: T[]): T => arr[Math.floor(rng() * arr.length)];
const chance = (p: number) => rng() < p;
const between = (min: number, max: number) => min + rng() * (max - min);
const intBetween = (min: number, max: number) => Math.floor(between(min, max + 1));

// "Hoje" do protótipo
export const HOJE = new Date("2026-06-19T12:00:00-03:00");

const DESTINOS = [
  "Maldivas",
  "Disney/Orlando",
  "Gramado",
  "Cancún",
  "Paris",
  "Buenos Aires",
  "Lisboa",
  "Nordeste (Maceió)",
  "Patagônia",
  "Dubai",
  "Fernando de Noronha",
  "Roma",
];

const ASSUNTOS = [
  "Cotação de pacote",
  "Dúvida sobre documentação/visto",
  "Reclamação",
  "Pós-venda",
  "Alteração de reserva",
  "Informação de preço",
  "Seguro viagem",
  "Disponibilidade de datas",
];

const CANAIS: Canal[] = ["whatsapp", "whatsapp", "whatsapp", "instagram", "webchat", "telegram"];

const AGENTES = [
  { id: "agt_isa", name: "Iza (IA)" },
  { id: "agt_isa", name: "Iza (IA)" },
  { id: "agt_lia", name: "Lia (humano)" },
];

const NOMES = [
  "Ana Beatriz Costa", "Carlos Henrique Lima", "Mariana Souza", "Pedro Almeida",
  "Juliana Ferreira", "Rafael Oliveira", "Camila Rodrigues", "Bruno Carvalho",
  "Larissa Martins", "Thiago Nunes", "Patrícia Gomes", "Felipe Araújo",
  "Renata Dias", "Gustavo Pereira", "Bianca Ribeiro", "Lucas Mendes",
  "Fernanda Castro", "Rodrigo Barbosa", "Aline Cardoso", "Marcelo Teixeira",
];

const ANUNCIOS = [
  "Pacote Maldivas 7 noites all-inclusive",
  "Disney 2026 — parcele em 12x",
  "Gramado no inverno — promoção",
  "Réveillon em Cancún",
  null, // origem orgânica
  null,
];

const TAGS_POOL = ["vip", "lua-de-mel", "família", "promoção", "grupo", "corporativo", "recorrente"];

// Mensagens de exemplo por assunto (usuário → agente)
const DIALOGOS: Record<string, [string, string][]> = {
  "Cotação de pacote": [
    ["Oi! Quero um orçamento de {destino} para 2 adultos em {mes}.", "Claro! Para {destino} em {mes} tenho pacotes a partir de R$ {preco} por pessoa com aéreo + hotel. Quer que eu detalhe?"],
    ["Pode ser 7 noites?", "Perfeito, 7 noites com café da manhã fecha em R$ {preco} por pessoa. Posso segurar essa tarifa por 48h."],
  ],
  "Dúvida sobre documentação/visto": [
    ["Preciso de visto para {destino}?", "Para {destino} é necessário visto sim. Posso te enviar a lista de documentos e ajudar no agendamento."],
    ["E o passaporte precisa de validade mínima?", "Sim, recomenda-se pelo menos 6 meses de validade a partir da data de retorno."],
  ],
  Reclamação: [
    ["O hotel em {destino} não era o que foi prometido, estou muito insatisfeito.", "Sinto muito pelo ocorrido. Vou registrar sua reclamação e acionar o fornecedor para uma solução o quanto antes."],
    ["Quero um reembolso.", "Entendo. Vou encaminhar para o setor responsável e retorno com a posição em até 48h úteis."],
  ],
  "Pós-venda": [
    ["Já comprei o pacote para {destino}, como faço o check-in?", "Ótimo! O check-in online abre 48h antes. Te envio o passo a passo e os vouchers agora."],
    ["Obrigado, ficou tudo certo!", "Que ótimo! Qualquer coisa durante a viagem, estou à disposição. Boa viagem! 🌴"],
  ],
  "Alteração de reserva": [
    ["Preciso mudar a data da viagem para {destino}.", "Sem problemas. Para qual período deseja alterar? Verifico disponibilidade e eventuais diferenças tarifárias."],
    ["Para o mês seguinte.", "Consegui remanejar! Houve uma diferença de R$ {preco}. Posso confirmar a alteração?"],
  ],
  "Informação de preço": [
    ["Quanto custa {destino} em média?", "Depende da época, mas atualmente {destino} sai a partir de R$ {preco} por pessoa. Quer uma cotação personalizada?"],
    ["Tem como parcelar?", "Sim! Parcelamos em até 12x sem juros no cartão."],
  ],
  "Seguro viagem": [
    ["O seguro viagem para {destino} é obrigatório?", "Para {destino} o seguro é altamente recomendado e, em alguns casos, obrigatório. Cobertura a partir de R$ 90."],
    ["Pode incluir no pacote?", "Posso sim, fica tudo numa fatura só. Quer que eu adicione?"],
  ],
  "Disponibilidade de datas": [
    ["Tem vaga para {destino} no feriado?", "Deixa eu checar... Para o feriado ainda tenho disponibilidade limitada em {destino}. Quer que eu reserve?"],
    ["Sim, por favor.", "Reserva pré-confirmada! Te envio os detalhes para fechamento."],
  ],
};

const MESES = ["janeiro", "fevereiro", "julho", "dezembro", "setembro", "outubro"];

function preencher(tpl: string, destino: string): string {
  return tpl
    .replaceAll("{destino}", destino)
    .replaceAll("{mes}", pick(MESES))
    .replaceAll("{preco}", String(intBetween(3, 28) * 500));
}

function sentimentoPorFrustration(frustration: number, resolvida: Resolutividade): Sentimento {
  if (frustration > 0.6) return "negativo";
  if (resolvida === "sim" && frustration < 0.25) return "positivo";
  return "neutro";
}

function intencaoPorAssunto(assunto: string): IntencaoCompra {
  if (assunto === "Cotação de pacote" || assunto === "Disponibilidade de datas")
    return chance(0.6) ? "alta" : "media";
  if (assunto === "Informação de preço") return chance(0.5) ? "media" : "baixa";
  if (assunto === "Reclamação") return "nenhuma";
  return chance(0.3) ? "baixa" : "nenhuma";
}

function gerarConversa(i: number): Conversation {
  const destino = pick(DESTINOS);
  const assunto = pick(ASSUNTOS);
  const canal = pick(CANAIS);
  const agente = canal === "whatsapp" && chance(0.8) ? AGENTES[0] : pick(AGENTES);
  const isAi = agente.id === "agt_isa" && chance(0.85);

  // distribui ao longo dos últimos 60 dias, com mais peso recente
  const diasAtras = Math.floor(Math.pow(rng(), 1.6) * 60);
  const horaBase = intBetween(8, 21);
  const start = new Date(HOJE);
  start.setDate(start.getDate() - diasAtras);
  start.setHours(horaBase, intBetween(0, 59), 0, 0);

  const dialogo = DIALOGOS[assunto];
  const turnos = Math.min(dialogo.length, intBetween(1, dialogo.length));
  const messages: Message[] = [];
  let cursor = new Date(start);
  for (let t = 0; t < turnos; t++) {
    const [u, a] = dialogo[t];
    messages.push({
      id: `msg_${i}_${t}_u`,
      conversationId: `conv_${i}`,
      messageId: `wamid_${i}_${t}_u`,
      role: "user",
      content: preencher(u, destino),
      createdAt: new Date(cursor).toISOString(),
    });
    cursor = new Date(cursor.getTime() + intBetween(30, 240) * 1000);
    messages.push({
      id: `msg_${i}_${t}_a`,
      conversationId: `conv_${i}`,
      messageId: `wamid_${i}_${t}_a`,
      role: "agent",
      content: preencher(a, destino),
      createdAt: new Date(cursor).toISOString(),
    });
    cursor = new Date(cursor.getTime() + intBetween(60, 600) * 1000);
  }

  const resolvida: Resolutividade =
    assunto === "Reclamação"
      ? pick<Resolutividade>(["nao", "parcial", "parcial"])
      : pick<Resolutividade>(["sim", "sim", "sim", "parcial", "nao"]);

  const frustration =
    assunto === "Reclamação"
      ? between(0.55, 0.95)
      : resolvida === "nao"
        ? between(0.4, 0.8)
        : resolvida === "parcial"
          ? between(0.25, 0.55)
          : between(0.02, 0.3);

  const sentimento = sentimentoPorFrustration(frustration, resolvida);
  const transferida = !isAi || chance(0.12);
  const status: Conversation["status"] = transferida
    ? "transferida"
    : resolvida === "sim"
      ? "resolvida"
      : chance(0.5)
        ? "aberta"
        : "pendente";

  const anuncio = pick(ANUNCIOS);
  const tags: string[] = [];
  if (chance(0.4)) tags.push(pick(TAGS_POOL));
  if (chance(0.2)) tags.push(pick(TAGS_POOL));

  const nome = NOMES[i % NOMES.length];
  const firstAt = messages[0].createdAt;
  const lastAt = messages[messages.length - 1].createdAt;

  // NPS para parte das conversas
  let nps: NpsRating | undefined;
  if (chance(0.5)) {
    const rating =
      sentimento === "positivo"
        ? intBetween(8, 10)
        : sentimento === "negativo"
          ? intBetween(0, 6)
          : intBetween(6, 8);
    nps = {
      id: `nps_${i}`,
      conversationId: `conv_${i}`,
      rating,
      comment:
        rating >= 9
          ? "Atendimento excelente, muito atenciosa!"
          : rating <= 6
            ? "Demorou para resolver, fiquei frustrado."
            : "Atendimento ok.",
      completionReason: "fluxo_concluido",
      completedAt: new Date(new Date(lastAt).getTime() + 3600 * 1000).toISOString(),
    };
  }

  return {
    conversationId: `conv_${i}`,
    organizationId: "org_isatravel",
    agentId: agente.id,
    agentName: agente.name,
    channel: canal,
    status,
    priority: assunto === "Reclamação" ? "alta" : pick(["baixa", "media", "media"]),
    isAiEnabled: isAi,
    userName: nome,
    userEmail: `${nome.split(" ")[0].toLowerCase()}@email.com`,
    userPhone: `+55 11 9${intBetween(1000, 9999)}-${intBetween(1000, 9999)}`,
    firstMessageAt: firstAt,
    lastMessageAt: lastAt,
    messageCount: messages.length,
    frustration: Number(frustration.toFixed(2)),
    summary: `Cliente tratou sobre "${assunto.toLowerCase()}" referente a ${destino}.`,
    ctwa: anuncio
      ? {
          headline: anuncio,
          body: "Clique e fale com um especialista no WhatsApp",
          sourceUrl: "https://fb.com/ad",
          mediaType: "image",
          clickedAt: firstAt,
        }
      : undefined,
    destinoPrincipal: destino,
    destinos: [destino],
    assunto,
    resolvida,
    sentimento,
    intencaoCompra: intencaoPorAssunto(assunto),
    enrichedAt: new Date(new Date(lastAt).getTime() + 120 * 1000).toISOString(),
    tags,
    messages,
    nps,
  };
}

export const conversations: Conversation[] = Array.from({ length: 64 }, (_, i) =>
  gerarConversa(i),
).sort((a, b) => +new Date(b.lastMessageAt) - +new Date(a.lastMessageAt));

// ---- raw_events derivados (para a tela de Eventos/Simulador) ----
export const rawEvents: RawEvent[] = conversations
  .flatMap((c) =>
    c.messages
      .filter((m) => m.role === "agent")
      .map<RawEvent>((m, idx) => ({
        id: `evt_${c.conversationId}_${idx}`,
        eventType: c.isAiEnabled ? "AGENT_USER_MESSAGE" : "AGENT_MESSAGE_SENDED",
        conversationId: c.conversationId,
        messageId: m.messageId,
        payload: {
          eventType: c.isAiEnabled ? "AGENT_USER_MESSAGE" : "AGENT_MESSAGE_SENDED",
          conversationId: c.conversationId,
          agentId: c.agentId,
          agentName: c.agentName,
          channel: c.channel,
          conversationStatus: c.status,
          conversationPriority: c.priority,
          isAiEnabled: c.isAiEnabled,
          organizationId: c.organizationId,
          messageId: m.messageId,
          agentResponse: m.content,
          frustration: c.frustration,
          summary: c.summary,
          tags: c.tags,
          createdAt: m.createdAt,
        },
        authValid: true,
        receivedAt: m.createdAt,
        processed: true,
        processedAt: new Date(new Date(m.createdAt).getTime() + 5000).toISOString(),
      })),
  )
  .sort((a, b) => +new Date(b.receivedAt) - +new Date(a.receivedAt));
