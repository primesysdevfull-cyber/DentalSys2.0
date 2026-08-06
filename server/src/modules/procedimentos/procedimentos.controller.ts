import { Response } from "express";
import { z } from "zod";
import prisma from "../../config/database";
import { AuthRequest } from "../../middleware/auth";

const procedimentoSchema = z.object({
  nome: z.string().min(2, "Nome é obrigatório"),
  codigoTuss: z.string().optional().nullable(),
  valorParticular: z.coerce.number().min(0).optional(),
  duracaoMedia: z.coerce.number().int().min(1).optional(),
  ativo: z.boolean().optional(),
});

export async function listarProcedimentos(req: AuthRequest, res: Response) {
  const { clinicaId } = req.auth!;
  const { busca } = req.query;
  const procedimentos = await prisma.procedimento.findMany({
    where: {
      clinicaId,
      ...(typeof busca === "string" && busca.length > 0
        ? { nome: { contains: busca, mode: "insensitive" } }
        : {}),
    },
    include: { convenios: { include: { convenio: { select: { id: true, nome: true } } } } },
    orderBy: { nome: "asc" },
  });
  res.json(procedimentos);
}

export async function obterProcedimento(req: AuthRequest, res: Response) {
  const { clinicaId } = req.auth!;
  const procedimento = await prisma.procedimento.findFirst({
    where: { id: req.params.id, clinicaId },
    include: { convenios: { include: { convenio: { select: { id: true, nome: true } } } } },
  });
  if (!procedimento) {
    return res.status(404).json({ error: "Procedimento não encontrado" });
  }
  res.json(procedimento);
}

export async function criarProcedimento(req: AuthRequest, res: Response) {
  const { clinicaId } = req.auth!;
  const dados = procedimentoSchema.parse(req.body);
  const procedimento = await prisma.procedimento.create({
    data: { ...dados, clinicaId },
  });
  res.status(201).json(procedimento);
}

export async function atualizarProcedimento(req: AuthRequest, res: Response) {
  const { clinicaId } = req.auth!;
  const existente = await prisma.procedimento.findFirst({ where: { id: req.params.id, clinicaId } });
  if (!existente) {
    return res.status(404).json({ error: "Procedimento não encontrado" });
  }

  const dados = procedimentoSchema.partial().parse(req.body);
  const procedimento = await prisma.procedimento.update({
    where: { id: existente.id },
    data: dados,
  });
  res.json(procedimento);
}

export async function excluirProcedimento(req: AuthRequest, res: Response) {
  const { clinicaId } = req.auth!;
  const existente = await prisma.procedimento.findFirst({ where: { id: req.params.id, clinicaId } });
  if (!existente) {
    return res.status(404).json({ error: "Procedimento não encontrado" });
  }
  await prisma.procedimento.delete({ where: { id: existente.id } });
  res.status(204).send();
}

const valorConvenioSchema = z.object({
  convenioId: z.string(),
  valor: z.coerce.number().min(0),
});

export async function definirValorConvenio(req: AuthRequest, res: Response) {
  const { clinicaId } = req.auth!;
  const dados = valorConvenioSchema.parse(req.body);

  const procedimento = await prisma.procedimento.findFirst({
    where: { id: req.params.id, clinicaId },
  });
  if (!procedimento) {
    return res.status(404).json({ error: "Procedimento não encontrado" });
  }

  const convenio = await prisma.convenio.findFirst({ where: { id: dados.convenioId, clinicaId } });
  if (!convenio) {
    return res.status(404).json({ error: "Convênio não encontrado" });
  }

  const valor = await prisma.convenioProcedimento.upsert({
    where: { convenioId_procedimentoId: { convenioId: dados.convenioId, procedimentoId: procedimento.id } },
    create: { convenioId: dados.convenioId, procedimentoId: procedimento.id, valor: dados.valor },
    update: { valor: dados.valor },
  });

  res.json(valor);
}
