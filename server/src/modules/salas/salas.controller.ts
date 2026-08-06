import { Response } from "express";
import { z } from "zod";
import prisma from "../../config/database";
import { AuthRequest } from "../../middleware/auth";

const salaSchema = z.object({
  nome: z.string().min(2, "Nome da sala é obrigatório"),
  ativa: z.boolean().optional(),
});

export async function listarSalas(req: AuthRequest, res: Response) {
  const { clinicaId } = req.auth!;
  const salas = await prisma.sala.findMany({
    where: { clinicaId },
    orderBy: { nome: "asc" },
  });
  res.json(salas);
}

export async function criarSala(req: AuthRequest, res: Response) {
  const { clinicaId } = req.auth!;
  const dados = salaSchema.parse(req.body);
  const sala = await prisma.sala.create({ data: { ...dados, clinicaId } });
  res.status(201).json(sala);
}

export async function atualizarSala(req: AuthRequest, res: Response) {
  const { clinicaId } = req.auth!;
  const existente = await prisma.sala.findFirst({ where: { id: req.params.id, clinicaId } });
  if (!existente) {
    return res.status(404).json({ error: "Sala não encontrada" });
  }
  const dados = salaSchema.partial().parse(req.body);
  const sala = await prisma.sala.update({ where: { id: existente.id }, data: dados });
  res.json(sala);
}

export async function excluirSala(req: AuthRequest, res: Response) {
  const { clinicaId } = req.auth!;
  const existente = await prisma.sala.findFirst({ where: { id: req.params.id, clinicaId } });
  if (!existente) {
    return res.status(404).json({ error: "Sala não encontrada" });
  }
  await prisma.sala.delete({ where: { id: existente.id } });
  res.status(204).send();
}
