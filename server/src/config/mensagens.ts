interface ResultadoEnvio {
  enviado: boolean;
  metodo: "whatsapp" | "sms" | "simulado";
  detalhe?: string;
}

const WPP_URL = process.env.WHATSAPP_API_URL || "";
const WPP_TOKEN = process.env.WHATSAPP_API_TOKEN || "";
const WPP_INSTANCE = process.env.WHATSAPP_INSTANCE || "";

function normalizarTelefone(contato: string): string {
  const digitos = contato.replace(/\D/g, "");
  if (digitos.length < 10) return digitos;
  if (digitos.length === 11 && digitos.startsWith("0")) return digitos.slice(1);
  if (digitos.length === 12 && digitos.startsWith("55")) return digitos;
  if (digitos.length === 11 && digitos.startsWith("9") === false && !digitos.startsWith("55")) {
    return `55${digitos}`;
  }
  if (digitos.length === 10) return `55${digitos}`;
  return digitos.length === 11 ? `55${digitos}` : digitos;
}

async function enviarViaWhatsApp(contato: string, mensagem: string): Promise<ResultadoEnvio> {
  const telefone = normalizarTelefone(contato);
  const endpoint = WPP_INSTANCE
    ? `${WPP_URL}/message/sendText/${WPP_INSTANCE}`
    : `${WPP_URL}/message/sendText`;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(WPP_TOKEN ? { Authorization: `Bearer ${WPP_TOKEN}` } : {}),
    },
    body: JSON.stringify({ number: telefone, text: mensagem }),
  });

  if (!res.ok) {
    throw new Error(`Erro no provedor de WhatsApp: ${res.status}`);
  }
  return { enviado: true, metodo: "whatsapp", detalhe: telefone };
}

export async function enviarMensagem(contato: string, mensagem: string): Promise<ResultadoEnvio> {
  if (WPP_URL) {
    try {
      return await enviarViaWhatsApp(contato, mensagem);
    } catch (e) {
      return { enviado: false, metodo: "whatsapp", detalhe: (e as Error).message };
    }
  }

  return { enviado: false, metodo: "simulado", detalhe: `Simulado. Configure WHATSAPP_API_URL para envio real.` };
}

export function envioConfigurado(): boolean {
  return Boolean(WPP_URL);
}
