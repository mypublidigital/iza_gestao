// Gerador de dados de demonstração (server-only). Produz eventos variados no formato do
// Chatvolt para popular o banco via o pipeline REAL (raw_events → processar → enriquecer).

interface SeedRow {
  event_type: string;
  conversation_id: string;
  message_id: string | null;
  payload: Record<string, unknown>;
  auth_valid: boolean;
}

const DESTINOS = [
  "Maldivas", "Disney/Orlando", "Gramado", "Cancún", "Paris", "Buenos Aires",
  "Lisboa", "Nordeste (Maceió)", "Dubai", "Fernando de Noronha", "Roma", "Patagônia",
];
const CANAIS = ["whatsapp", "whatsapp", "whatsapp", "instagram", "webchat", "telegram"];
const NOMES = [
  "Ana Beatriz Costa", "Carlos Henrique Lima", "Mariana Souza", "Pedro Almeida",
  "Juliana Ferreira", "Rafael Oliveira", "Camila Rodrigues", "Bruno Carvalho",
  "Larissa Martins", "Thiago Nunes", "Patrícia Gomes", "Felipe Araújo",
  "Renata Dias", "Gustavo Pereira", "Bianca Ribeiro",
];
const ANUNCIOS = ["Pacote Maldivas 7 noites all-inclusive", "Disney 2026 — parcele em 12x", null, null];
const TAGS = ["vip", "lua-de-mel", "família", "promoção", "grupo"];

// [userMessage, agentResponse] por tipo de conversa
const DIALOGOS: [string, string][][] = [
  [
    ["Oi! Quero um orçamento para {d} para 2 adultos em setembro.", "Claro! Para {d} em setembro tenho pacotes a partir de R$ {p} por pessoa com aéreo + hotel. Quer que eu detalhe?"],
    ["Pode ser 7 noites?", "Perfeito, 7 noites com café da manhã fecha em R$ {p} por pessoa. Posso segurar a tarifa por 48h."],
  ],
  [
    ["Preciso de visto para {d}?", "Para {d} é necessário visto sim. Te envio a lista de documentos e ajudo no agendamento."],
    ["E a validade do passaporte?", "Recomenda-se pelo menos 6 meses de validade a partir da data de retorno."],
  ],
  [
    ["O hotel em {d} não era o que foi prometido, estou muito insatisfeito.", "Sinto muito pelo ocorrido. Vou registrar sua reclamação e acionar o fornecedor o quanto antes."],
    ["Quero reembolso.", "Entendo. Vou encaminhar ao setor responsável e retorno em até 48h úteis."],
  ],
  [
    ["Quanto custa {d} em média?", "Depende da época, mas {d} sai a partir de R$ {p} por pessoa. Quer uma cotação personalizada?"],
    ["Dá pra parcelar?", "Sim! Em até 12x sem juros no cartão."],
  ],
  [
    ["Já comprei o pacote para {d}, como faço o check-in?", "Ótimo! O check-in online abre 48h antes. Te envio o passo a passo e os vouchers agora."],
    ["Obrigado, ficou tudo certo!", "Que ótimo! Qualquer coisa durante a viagem, estou à disposição. Boa viagem! 🌴"],
  ],
  [
    ["Tem vaga para {d} no feriado?", "Deixa eu checar... Ainda tenho disponibilidade limitada em {d}. Quer que eu reserve?"],
    ["Sim, por favor.", "Reserva pré-confirmada! Te envio os detalhes para fechamento."],
  ],
];

function rand(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

export function buildSeedRows(n = 15): SeedRow[] {
  const r = rand(Date.now() % 100000);
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
  const rows: SeedRow[] = [];
  const stamp = Date.now();

  for (let i = 0; i < n; i++) {
    const convId = `seed_${stamp}_${i}`;
    const destino = pick(DESTINOS);
    const canal = pick(CANAIS);
    const nome = pick(NOMES);
    const dialogo = DIALOGOS[i % DIALOGOS.length];
    const anuncio = pick(ANUNCIOS);
    const tags = r() < 0.4 ? [pick(TAGS)] : [];

    const diasAtras = Math.floor(Math.pow(r(), 1.5) * 30);
    const hora = 8 + Math.floor(r() * 13);
    const base = new Date();
    base.setDate(base.getDate() - diasAtras);
    base.setHours(hora, Math.floor(r() * 60), 0, 0);

    let t = 0;
    dialogo.forEach(([u, a], idx) => {
      const createdAt = new Date(base.getTime() + t * 90_000).toISOString();
      t++;
      rows.push({
        event_type: "AGENT_USER_MESSAGE",
        conversation_id: convId,
        message_id: `${convId}_m${idx}`,
        auth_valid: true,
        payload: {
          eventType: "AGENT_USER_MESSAGE",
          conversationId: convId,
          agentId: "agt_isa",
          agentName: "Iza (IA)",
          channel: canal,
          conversationStatus: "aberta",
          conversationPriority: "media",
          isAiEnabled: true,
          organizationId: "org_isatravel",
          messageId: `${convId}_m${idx}`,
          userMessage: u.replaceAll("{d}", destino).replaceAll("{p}", String((1 + Math.floor(r() * 25)) * 500)),
          agentResponse: a.replaceAll("{d}", destino).replaceAll("{p}", String((1 + Math.floor(r() * 25)) * 500)),
          userName: nome,
          userPhoneNumber: `+55 11 9${1000 + Math.floor(r() * 8999)}-${1000 + Math.floor(r() * 8999)}`,
          summary: `Cliente tratou sobre ${destino}.`,
          frustration: Number((r() * 0.6).toFixed(2)),
          tags,
          ...(anuncio && idx === 0
            ? { ctwaAttributions: [{ headline: anuncio, body: "Fale com um especialista", sourceUrl: "https://fb.com/ad", mediaType: "image", clickedAt: createdAt }] }
            : {}),
          createdAt,
        },
      });
    });

    // NPS em parte das conversas
    if (r() < 0.55) {
      const rating = 4 + Math.floor(r() * 7);
      rows.push({
        event_type: "NPS_INTERACTION",
        conversation_id: convId,
        message_id: null,
        auth_valid: true,
        payload: {
          eventType: "NPS_INTERACTION",
          conversationId: convId,
          agentId: "agt_isa",
          agentName: "Iza (IA)",
          channel: canal,
          conversationStatus: "resolvida",
          conversationPriority: "media",
          isAiEnabled: true,
          organizationId: "org_isatravel",
          rating,
          comment: rating >= 9 ? "Atendimento excelente!" : rating <= 6 ? "Demorou para resolver." : "Atendimento ok.",
          completionReason: "fluxo_concluido",
          completedAt: new Date(base.getTime() + 3_600_000).toISOString(),
        },
      });
    }
  }
  return rows;
}
