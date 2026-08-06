import { Response } from "express";
import { z } from "zod";
import prisma from "../../config/database";
import { AuthRequest } from "../../middleware/auth";

function inicioDoDia(data: Date): Date {
  return new Date(data.getFullYear(), data.getMonth(), data.getDate());
}

function fimDoDia(data: Date): Date {
  return new Date(data.getFullYear(), data.getMonth(), data.getDate(), 23, 59, 59, 999);
}

export async function movimentacoesDoDia(clinicaId: string, dia: Date) {
  const lancamentos = await prisma.lancamento.findMany({
    where: {
      clinicaId,
      status: "pago",
      dataPagamento: { gte: inicioDoDia(dia), lte: fimDoDia(dia) },
    },
    select: { id: true, tipo: true, valor: true, desconto: true, formaPagamento: true },
  });

  let receitas = 0;
  let despesas = 0;
  const porForma: Record<string, number> = {};

  for (const l of lancamentos) {
    const liquido = Number(l.valor) - Number(l.desconto || 0);
    if (l.tipo === "receita") {
      receitas += liquido;
      const key = l.formaPagamento || "outros";
      porForma[key] = (porForma[key] || 0) + liquido;
    } else {
      despesas += liquido;
    }
  }

  return { totalReceitas: receitas, totalDespesas: despesas, totalGeral: receitas - despesas, porForma };
}

async function obterFechamento(clinicaId: string, dia: Date) {
  return prisma.fechamentoCaixa.findUnique({
    where: { clinicaId_data: { clinicaId, data: inicioDoDia(dia) } },
    include: { responsavel: { select: { id: true, nome: true, cargo: true } } },
  });
}

export async function obterCaixa(req: AuthRequest, res: Response) {
  const { clinicaId } = req.auth!;
  const data = req.query.data ? new Date(String(req.query.data)) : new Date();

  const movimentacoes = await movimentacoesDoDia(clinicaId, data);
  const fechamento = await obterFechamento(clinicaId, data);

  res.json({
    data: inicioDoDia(data),
    fechamento,
    totais: movimentacoes,
  });
}

const abrirCaixaSchema = z.object({
  data: z.string().datetime().optional().nullable(),
  dinheiroInicial: z.number().min(0).default(0),
  observacoes: z.string().max(500).optional().nullable(),
});

export async function abrirCaixa(req: AuthRequest, res: Response) {
  const { clinicaId } = req.auth!;
  const { data, dinheiroInicial, observacoes } = abrirCaixaSchema.parse(req.body as object);
  const dia = inicioDoDia(data ? new Date(data) : new Date());

  const existente = await obterFechamento(clinicaId, dia);
  if (existente) {
    return res.status(400).json({ error: "Caixa deste dia já foi aberto" });
  }

  const fechamento = await prisma.fechamentoCaixa.create({
    data: {
      clinicaId,
      data: dia,
      situacao: "aberto",
      dinheiroInicial,
      totalGeral: dinheiroInicial,
      observacoes,
      usuarioId: req.auth!.userId,
      abertoEm: new Date(),
    },
    include: { responsavel: { select: { id: true, nome: true, cargo: true } } },
  });

  res.status(201).json(serializarCaixa(fechamento));
}

const fecharCaixaSchema = z.object({
  valorInformado: z.number().min(0),
  observacoes: z.string().max(500).optional().nullable(),
});

export async function fecharCaixa(req: AuthRequest, res: Response) {
  const { clinicaId } = req.auth!;
  const { valorInformado, observacoes } = fecharCaixaSchema.parse(req.body as object);
  const dia = inicioDoDia(new Date());

  const fechamento = await obterFechamento(clinicaId, dia);
  if (!fechamento) {
    return res.status(400).json({ error: "Caixa deste dia não está aberto. Abra o caixa primeiro." });
  }
  if (fechamento.situacao === "fechado") {
    return res.status(400).json({ error: "Caixa deste dia já foi fechado" });
  }

  const movimentacoes = await movimentacoesDoDia(clinicaId, dia);
  const totalGeral = Number(fechamento.dinheiroInicial) + movimentacoes.totalGeral;
  const divergencia = valorInformado - totalGeral;

  const atualizado = await prisma.fechamentoCaixa.update({
    where: { id: fechamento.id },
    data: {
      situacao: "fechado",
      totalReceitas: movimentacoes.totalReceitas,
      totalDespesas: movimentacoes.totalDespesas,
      totalGeral,
      valorInformado,
      divergencia,
      observacoes: observacoes ?? fechamento.observacoes,
      fechadoEm: new Date(),
    },
    include: { responsavel: { select: { id: true, nome: true, cargo: true } } },
  });

  res.json(serializarCaixa(atualizado));
}

export async function listarHistoricoCaixa(req: AuthRequest, res: Response) {
  const { clinicaId } = req.auth!;
  const fechamentos = await prisma.fechamentoCaixa.findMany({
    where: { clinicaId },
    orderBy: { data: "desc" },
    take: 120,
    include: { responsavel: { select: { id: true, nome: true, cargo: true } } },
  });
  res.json(fechamentos.map(serializarCaixa));
}

function serializarCaixa(c: {
  id: string;
  data: Date;
  situacao: string;
  dinheiroInicial: unknown;
  totalReceitas: unknown;
  totalDespesas: unknown;
  totalGeral: unknown;
  valorInformado: unknown;
  divergencia: unknown;
  observacoes: string | null;
  abertoEm: Date | null;
  fechadoEm: Date | null;
  responsavel: { id: string; nome: string; cargo: string } | null;
}) {
  return {
    id: c.id,
    data: c.data.toISOString(),
    situacao: c.situacao,
    dinheiroInicial: Number(c.dinheiroInicial),
    totalReceitas: Number(c.totalReceitas),
    totalDespesas: Number(c.totalDespesas),
    totalGeral: Number(c.totalGeral),
    valorInformado: c.valorInformado === null ? null : Number(c.valorInformado),
    divergencia: c.divergencia === null ? null : Number(c.divergencia),
    observacoes: c.observacoes,
    abertoEm: c.abertoEm?.toISOString() ?? null,
    fechadoEm: c.fechadoEm?.toISOString() ?? null,
    responsavel: c.responsavel,
  };
}