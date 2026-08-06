import { Response } from "express";
import { z } from "zod";
import prisma from "../../config/database";
import { AuthRequest } from "../../middleware/auth";

const convenioSchema = z.object({
  nome: z.string().min(2, "Nome é obrigatório"),
  registro: z.string().optional().nullable(),
  telefone: z.string().optional().nullable(),
  ativo: z.boolean().optional(),
});

export async function listarConvenios(req: AuthRequest, res: Response) {
  const { clinicaId } = req.auth!;
  const convenios = await prisma.convenio.findMany({
    where: { clinicaId },
    include: { _count: { select: { procedimentos: true } } },
    orderBy: { nome: "asc" },
  });
  res.json(convenios);
}

export async function criarConvenio(req: AuthRequest, res: Response) {
  const { clinicaId } = req.auth!;
  const dados = convenioSchema.parse(req.body);
  const convenio = await prisma.convenio.create({ data: { ...dados, clinicaId } });
  res.status(201).json(convenio);
}

export async function atualizarConvenio(req: AuthRequest, res: Response) {
  const { clinicaId } = req.auth!;
  const existente = await prisma.convenio.findFirst({ where: { id: req.params.id, clinicaId } });
  if (!existente) {
    return res.status(404).json({ error: "Convênio não encontrado" });
  }
  const dados = convenioSchema.partial().parse(req.body);
  const convenio = await prisma.convenio.update({ where: { id: existente.id }, data: dados });
  res.json(convenio);
}

export async function excluirConvenio(req: AuthRequest, res: Response) {
  const { clinicaId } = req.auth!;
  const existente = await prisma.convenio.findFirst({ where: { id: req.params.id, clinicaId } });
  if (!existente) {
    return res.status(404).json({ error: "Convênio não encontrado" });
  }
  await prisma.convenio.delete({ where: { id: existente.id } });
  res.status(204).send();
}
