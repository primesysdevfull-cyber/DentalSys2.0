import { Request, Response } from "express";
import { z } from "zod";
import prisma from "../../config/database";
import { AuthRequest } from "../../middleware/auth";
import { criarCobrancaGateway, getConfigPublico } from "./efi.service";
import { baixarLancamentoInterno } from "../financeiro/financeiro.controller";

const configSchema = z.object({
  provider: z.string().default("efi"),
  ambiente: z.enum(["sandbox", "producao"]),
  clientId: z.string().trim().optional().nullable(),
  clientSecret: z.string().trim().optional().nullable(),
  pixChave: z.string().trim().optional().nullable(),
  webhookSecret: z.string().trim().optional().nullable(),
  webhookIp: z.string().trim().optional().nullable(),
  ativa: z.boolean().optional(),
});

const cartaoSchema = z.object({
  nome: z.string().trim().min(1, "Nome no cartão é obrigatório"),
  numero: z.string().regex(/^\d{13,19}$/, "Número do cartão inválido"),
  mesValidade: z.string().regex(/^\d{2}$/, "Mês de validade inválido"),
  anoValidade: z.string().regex(/^\d{4}$/, "Ano de validade inválido"),
  cvv: z.string().regex(/^\d{3,4}$/, "CVV inválido"),
  parcelas: z.coerce.number().int().min(1).max(12).default(1),
});

const cobrancaSchema = z.object({
  forma: z.enum(["pix", "boleto", "cartao"]),
  vencimento: z.string().datetime().optional().nullable(),
  cartao: cartaoSchema.optional(),
});

function serializarCobranca(c: {
  id: string;
  forma: string;
  valor: unknown;
  status: string;
  gatewayId: string | null;
  pixCopiaECola: string | null;
  pixQrCodeUrl: string | null;
  boletoLinha: string | null;
  boletoUrl: string | null;
  cartaoLink: string | null;
  cartaoParcelas: number | null;
  cartaoUltimosDigitos: string | null;
  dataVencimento: Date | null;
  dataPagamento: Date | null;
  erro: string | null;
  criadoEm: Date;
  lancamento: { id: string; descricao: string };
}) {
  return {
    id: c.id,
    forma: c.forma,
    valor: Number(c.valor),
    status: c.status,
    gatewayId: c.gatewayId,
    pixCopiaECola: c.pixCopiaECola,
    pixQrCodeUrl: c.pixQrCodeUrl,
    boletoLinha: c.boletoLinha,
    boletoUrl: c.boletoUrl,
    cartaoLink: c.cartaoLink,
    cartaoParcelas: c.cartaoParcelas,
    cartaoUltimosDigitos: c.cartaoUltimosDigitos,
    dataVencimento: c.dataVencimento?.toISOString() ?? null,
    dataPagamento: c.dataPagamento?.toISOString() ?? null,
    erro: c.erro,
    criadoEm: c.criadoEm.toISOString(),
    lancamento: c.lancamento,
  };
}

export async function obterConfig(req: AuthRequest, res: Response) {
  const { clinicaId } = req.auth!;
  res.json(await getConfigPublico(clinicaId));
}

export async function salvarConfig(req: AuthRequest, res: Response) {
  const { clinicaId } = req.auth!;
  const dados = configSchema.parse(req.body as object);

  const atual = await prisma.configPagamento.upsert({
    where: { clinicaId },
    create: {
      clinicaId,
      provider: dados.provider,
      ambiente: dados.ambiente,
      clientId: dados.clientId ?? null,
      clientSecret: dados.clientSecret ?? null,
      pixChave: dados.pixChave ?? null,
      webhookSecret: dados.webhookSecret ?? null,
      webhookIp: dados.webhookIp ?? null,
      ativa: dados.ativa ?? false,
    },
    update: {
      provider: dados.provider,
      ambiente: dados.ambiente,
      ...(dados.clientId !== undefined ? { clientId: dados.clientId } : {}),
      ...(dados.clientSecret !== undefined ? { clientSecret: dados.clientSecret } : {}),
      ...(dados.pixChave !== undefined ? { pixChave: dados.pixChave } : {}),
      ...(dados.webhookSecret !== undefined ? { webhookSecret: dados.webhookSecret } : {}),
      ...(dados.webhookIp !== undefined ? { webhookIp: dados.webhookIp } : {}),
      ...(dados.ativa !== undefined ? { ativa: dados.ativa } : {}),
    },
  });

  res.json({
    provider: atual.provider,
    ambiente: atual.ambiente,
    ativa: atual.ativa,
    temCredenciais: Boolean(atual.clientId && atual.clientSecret),
    pixChaveSet: Boolean(atual.pixChave),
    temWebhookSecret: Boolean(atual.webhookSecret),
    temWebhookIp: Boolean(atual.webhookIp),
  });
}

export async function criarCobranca(req: AuthRequest, res: Response) {
  const { clinicaId } = req.auth!;
  const parsed = cobrancaSchema.parse(req.body as object);
  const { forma, vencimento, cartao } = parsed;

  if (forma === "cartao" && !cartao) {
    return res.status(400).json({ error: "Dados do cartão são obrigatórios para cobrança no cartão" });
  }

  const lancamento = await prisma.lancamento.findFirst({
    where: { id: req.params.id, clinicaId },
    include: { paciente: { select: { nome: true, cpf: true, email: true } } },
  });

  if (!lancamento) {
    return res.status(404).json({ error: "Lançamento não encontrado" });
  }
  if (lancamento.status !== "pendente") {
    return res.status(400).json({ error: "Somente lançamentos pendentes podem gerar cobrança" });
  }

  const resultado = await criarCobrancaGateway(clinicaId, {
    forma,
    valor: Number(lancamento.valor),
    vencimento: vencimento ? new Date(vencimento) : undefined,
    descricao: lancamento.descricao,
    cliente: {
      nome: lancamento.paciente?.nome ?? null,
      cpf: lancamento.paciente?.cpf ?? null,
      email: lancamento.paciente?.email ?? null,
    },
    cartao,
  });

  const cobranca = await prisma.cobranca.create({
    data: {
      clinicaId,
      lancamentoId: lancamento.id,
      gateway: "efi",
      forma,
      valor: Number(lancamento.valor),
      status: resultado.pago ? "paga" : "pendente",
      gatewayId: resultado.gatewayId,
      pixCopiaECola: resultado.pixCopiaECola,
      pixQrCodeUrl: resultado.pixQrCodeUrl,
      boletoLinha: resultado.boletoLinha,
      boletoUrl: resultado.boletoUrl,
      cartaoLink: resultado.cartaoLink,
      cartaoParcelas: cartao?.parcelas ?? null,
      cartaoUltimosDigitos: cartao?.numero ? cartao.numero.slice(-4) : null,
      dataPagamento: resultado.pago ? new Date() : undefined,
      dataVencimento: vencimento ? new Date(vencimento) : undefined,
    },
    include: { lancamento: { select: { id: true, descricao: true } } },
  });

  if (resultado.pago) {
    await baixarLancamentoInterno(clinicaId, lancamento.id);
  }

  res.status(201).json(serializarCobranca(cobranca));
}

export async function obterCobranca(req: AuthRequest, res: Response) {
  const { clinicaId } = req.auth!;
  const cobranca = await prisma.cobranca.findFirst({
    where: { id: req.params.id, clinicaId },
    include: { lancamento: { select: { id: true, descricao: true } } },
  });
  if (!cobranca) {
    return res.status(404).json({ error: "Cobrança não encontrada" });
  }
  res.json(serializarCobranca(cobranca));
}

export async function marcarPago(req: AuthRequest, res: Response) {
  const { clinicaId } = req.auth!;
  const cobranca = await prisma.cobranca.findFirst({
    where: { id: req.params.id, clinicaId },
    select: { id: true, lancamentoId: true },
  });
  if (!cobranca) {
    return res.status(404).json({ error: "Cobrança não encontrada" });
  }

  await prisma.cobranca.update({
    where: { id: cobranca.id },
    data: { status: "paga", dataPagamento: new Date() },
  });
  await baixarLancamentoInterno(clinicaId, cobranca.lancamentoId);

  res.json({ ok: true, status: "paga" });
}

export async function webhookPagamento(req: Request, res: Response) {
  const config = await prisma.configPagamento.findFirst();

  if (config) {
    const ip = req.ip || (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() || "";
    if (config.webhookIp && ip && ip !== config.webhookIp) {
      return res.status(401).json({ ok: false, error: "IP não autorizado" });
    }
    if (config.webhookSecret) {
      const recebido = typeof req.query.hmac === "string" ? req.query.hmac : typeof req.query.token === "string" ? req.query.token : null;
      if (!recebido || recebido !== config.webhookSecret) {
        return res.status(401).json({ ok: false, error: "HMAC inválido" });
      }
    }
  }

  const body = (req.body || {}) as {
    txid?: string;
    identificador?: string;
    charge?: number;
    status?: string;
  };

  const gatewayId = body.txid || body.identificador || (body.charge != null ? String(body.charge) : null);
  if (!gatewayId) {
    return res.status(400).json({ ok: false, error: "Identificador não informado" });
  }

  const cobranca = await prisma.cobranca.findFirst({
    where: { gatewayId },
    select: { id: true, status: true, clinicaId: true, lancamentoId: true },
  });
  if (!cobranca) {
    return res.status(404).json({ ok: false, error: "Cobrança não encontrada" });
  }

  const pago = ["pago", "confirmado", "realizado", "confirmed", "paid"].includes(
    String(body.status || "").toLowerCase()
  );

  if (pago && cobranca.status !== "paga") {
    await prisma.cobranca.update({
      where: { id: cobranca.id },
      data: { status: "paga", dataPagamento: new Date() },
    });
    await baixarLancamentoInterno(cobranca.clinicaId, cobranca.lancamentoId);
  }

  res.json({ ok: true });
}