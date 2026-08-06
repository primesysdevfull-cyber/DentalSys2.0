import prisma from "../../config/database";

export type FormaPagamento = "pix" | "boleto" | "cartao";

export interface DadosCartao {
  nome: string;
  numero: string;
  mesValidade: string;
  anoValidade: string;
  cvv: string;
  parcelas: number;
}

export interface DadosPagamento {
  forma: FormaPagamento;
  valor: number;
  vencimento?: Date;
  cliente: { nome?: string | null; cpf?: string | null; email?: string | null };
  descricao: string;
  cartao?: DadosCartao;
}

export interface ResultadoCobranca {
  forma: FormaPagamento;
  gatewayId: string | null;
  pixCopiaECola: string | null;
  pixQrCodeUrl: string | null;
  boletoLinha: string | null;
  boletoUrl: string | null;
  cartaoLink: string | null;
  simulado: boolean;
  pago: boolean;
}

export interface ConfigPagamentoPublico {
  provider: string;
  ambiente: string;
  ativa: boolean;
  temCredenciais: boolean;
  pixChaveSet: boolean;
  temWebhookSecret: boolean;
  temWebhookIp: boolean;
}

async function getConfig(clinicaId: string) {
  let config = await prisma.configPagamento.findUnique({ where: { clinicaId } });
  if (!config) {
    config = await prisma.configPagamento.create({
      data: { clinicaId, provider: "efi", ambiente: "sandbox", ativa: false },
    });
  }
  return config;
}

async function getConfigPublico(clinicaId: string): Promise<ConfigPagamentoPublico> {
  const c = await getConfig(clinicaId);
  return {
    provider: c.provider,
    ambiente: c.ambiente,
    ativa: c.ativa,
    temCredenciais: Boolean(c.clientId && c.clientSecret),
    pixChaveSet: Boolean(c.pixChave),
    temWebhookSecret: Boolean(c.webhookSecret),
    temWebhookIp: Boolean(c.webhookIp),
  };
}

function basePix(ambiente: string): string {
  return ambiente === "producao" ? "https://api-pix.gerencianet.com.br" : "https://api-pix-h.gerencianet.com.br";
}

function baseApi(ambiente: string): string {
  return ambiente === "producao" ? "https://api.gerencianet.com.br" : "https://api-h.gerencianet.com.br";
}

async function pedirToken(base: string, clientId: string, clientSecret: string): Promise<string> {
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const resp = await fetch(`${base}/oauth/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ grant_type: "client_credentials" }),
  });
  if (!resp.ok) {
    throw new Error(`Erro ao obter token do gateway (HTTP ${resp.status}). Verifique as credenciais.`);
  }
  const json = (await resp.json()) as { access_token: string };
  return json.access_token;
}

function somenteNumeros(v: string): string {
  return v.replace(/\D/g, "");
}

async function criarPixReal(config: Awaited<ReturnType<typeof getConfig>>, d: DadosPagamento): Promise<ResultadoCobranca> {
  const base = basePix(config.ambiente);
  const token = await pedirToken(base, config.clientId!, config.clientSecret!);

  const body: Record<string, unknown> = {
    calendario: { expiracao: 3600 },
    valor: { original: d.valor.toFixed(2) },
    chave: config.pixChave!,
    solicitacaoPagador: d.descricao.slice(0, 140),
  };
  if (d.cliente?.nome) {
    body.devedor = { nome: d.cliente.nome, ...(d.cliente.cpf ? { cpf: somenteNumeros(d.cliente.cpf) } : {}) };
  }

  const resp = await fetch(`${base}/v2/cob`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const cob = (await resp.json()) as { txid?: string; loc?: { id?: number }; mensagem?: string };
  if (!resp.ok) {
    throw new Error(`Falha ao criar Pix: ${cob.mensagem || "erro no gateway"}`);
  }

  let copiaECola: string | null = null;
  let qrUrl: string | null = null;
  if (cob.loc?.id != null) {
    const qresp = await fetch(`${base}/v2/loc/${cob.loc.id}/qrcode`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const q = (await qresp.json()) as { qrcode?: string; imagemQrcode?: string };
    copiaECola = q.qrcode ?? null;
    if (q.imagemQrcode) qrUrl = `data:image/png;base64,${q.imagemQrcode}`;
  }

  return {
    forma: "pix",
    gatewayId: cob.txid ?? null,
    pixCopiaECola: copiaECola,
    pixQrCodeUrl: qrUrl,
    boletoLinha: null,
    boletoUrl: null,
    cartaoLink: null,
    simulado: false,
    pago: false,
  };
}

async function criarBoletoReal(config: Awaited<ReturnType<typeof getConfig>>, d: DadosPagamento): Promise<ResultadoCobranca> {
  const base = baseApi(config.ambiente);
  const token = await pedirToken(base, config.clientId!, config.clientSecret!);

  const body = {
    valor: d.valor.toFixed(2),
    vencimento: (d.vencimento || new Date(Date.now() + 3 * 86400000)).toISOString().slice(0, 10),
    itens: [{ nome: d.descricao.slice(0, 80), quantidade: 1, valor: d.valor.toFixed(2) }],
    cliente: {
      nome: d.cliente.nome || "Cliente",
      cpf: d.cliente.cpf ? somenteNumeros(d.cliente.cpf) : undefined,
      email: d.cliente.email || undefined,
    },
  };

  const resp = await fetch(`${base}/v1/cobrancas`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await resp.json()) as { id?: number; link?: string; linecode?: string; erro?: { mensagem?: string }; mensagem?: string };
  if (!resp.ok) {
    throw new Error(`Falha ao gerar boleto: ${json.erro?.mensagem || json.mensagem || "erro no gateway"}`);
  }

  return {
    forma: "boleto",
    gatewayId: json.id != null ? String(json.id) : null,
    boletoLinha: json.linecode ?? null,
    boletoUrl: json.link ?? null,
    pixCopiaECola: null,
    pixQrCodeUrl: null,
    cartaoLink: null,
    simulado: false,
    pago: false,
  };
}

function detectarBandeira(numero: string): string {
  const n = numero.replace(/\D/g, "");
  if (/^4/.test(n)) return "VISA";
  if (/^(34|37)/.test(n)) return "AMEX";
  if (/^(51|52|53|54|55|2221)/.test(n)) return "MASTERCARD";
  if (/^(636368|438935|504175|451416|636297|5067|4576|4011)/.test(n)) return "ELO";
  return "MASTERCARD";
}

async function criarCartaoReal(config: Awaited<ReturnType<typeof getConfig>>, d: DadosPagamento): Promise<ResultadoCobranca> {
  if (!d.cartao) {
    throw new Error("Dados do cartão não informados");
  }
  const base = baseApi(config.ambiente);
  const token = await pedirToken(base, config.clientId!, config.clientSecret!);

  const numeroLimpo = d.cartao.numero.replace(/\D/g, "");
  const mes = d.cartao.mesValidade.replace(/\D/g, "").padStart(2, "0");
  const ano = d.cartao.anoValidade.replace(/\D/g, "").slice(-2);
  const parcelas = Math.max(1, Math.min(12, d.cartao.parcelas || 1));
  const valorCentavos = Math.round(d.valor * 100);
  const valorParcelaCentavos = Math.round(valorCentavos / parcelas);

  const tokenResp = await fetch(`${base}/v1/charges/card/tokenize`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      card: {
        number: numeroLimpo,
        brand: detectarBandeira(numeroLimpo),
        cvc: d.cartao.cvv.replace(/\D/g, ""),
        expiration_month: mes,
        expiration_year: ano,
        name: d.cartao.nome,
      },
    }),
  });
  const tokenizado = (await tokenResp.json()) as { payment_token?: string; code?: number; message?: string; erro?: { mensagem?: string } };
  if (!tokenResp.ok || !tokenizado.payment_token) {
    throw new Error(`Falha ao tokenizar cartão: ${tokenizado.erro?.mensagem || tokenizado.message || "erro no gateway"}`);
  }

  const chargeResp = await fetch(`${base}/v1/charges`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      items: [{ name: d.descricao.slice(0, 80), value: valorCentavos, amount: 1 }],
      payment: {
        credit_card: {
          installments: parcelas,
          payment_token: tokenizado.payment_token,
        },
      },
    }),
  });
  const charge = (await chargeResp.json()) as {
    data?: { charge_id?: number; status?: string; message?: string };
    code?: number;
    message?: string;
    erro?: { mensagem?: string };
  };

  if (!chargeResp.ok) {
    throw new Error(`Falha ao processar cartão: ${charge.erro?.mensagem || charge.message || "erro no gateway"}`);
  }

  const status = (charge.data?.status || "").toLowerCase();
  const pago = ["paid", "authorized", "confirmed"].includes(status);

  return {
    forma: "cartao",
    gatewayId: charge.data?.charge_id != null ? String(charge.data.charge_id) : null,
    pixCopiaECola: null,
    pixQrCodeUrl: null,
    boletoLinha: null,
    boletoUrl: null,
    cartaoLink: null,
    simulado: false,
    pago,
  };
}

function idSimulacao(): string {
  return Math.random().toString(36).slice(2, 10).toUpperCase();
}

function simularCobranca(forma: FormaPagamento, d: DadosPagamento): ResultadoCobranca {
  const base: ResultadoCobranca = {
    forma,
    gatewayId: null,
    pixCopiaECola: null,
    pixQrCodeUrl: null,
    boletoLinha: null,
    boletoUrl: null,
    cartaoLink: null,
    simulado: true,
    pago: false,
  };

  if (forma === "pix") {
    return {
      ...base,
      pixCopiaECola: `00020126580014BR.GOV.BCB.PIX0136SIMULACAO-${idSimulacao()}52040000530398654${d.valor.toFixed(2)}5802BR5905TESTE6009COMERCIO`,
    };
  }
  if (forma === "boleto") {
    return {
      ...base,
      boletoLinha: `34191.79001 01043.510047 91020.150008 ${idSimulacao()} ${d.valor.toFixed(2).padStart(10, "0")}`,
    };
  }
  return base;
}

export async function criarCobrancaGateway(
  clinicaId: string,
  d: DadosPagamento
): Promise<ResultadoCobranca> {
  const config = await getConfig(clinicaId);
  const ativa = config.ativa && Boolean(config.clientId && config.clientSecret);

  if (!ativa) {
    return simularCobranca(d.forma, d);
  }

  if (d.forma === "pix") {
    if (!config.pixChave) {
      throw new Error("Configure a chave Pix em Configurações antes de gerar cobranças Pix.");
    }
    return criarPixReal(config, d);
  }
  if (d.forma === "boleto") {
    return criarBoletoReal(config, d);
  }
  return criarCartaoReal(config, d);
}

export { getConfig, getConfigPublico };