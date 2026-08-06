import { Response } from "express";
import { z } from "zod";
import prisma from "../../config/database";
import { AuthRequest } from "../../middleware/auth";

const clinicaSchema = z.object({
  nome: z.string().min(2),
  cnpj: z.string().optional(),
  email: z.string().email().optional(),
  telefone: z.string().optional().nullable(),
  endereco: z.string().optional().nullable(),
  razaoSocial: z.string().optional().nullable(),
  responsavel: z.string().optional().nullable(),
  logoUrl: z.string().optional().nullable(),
});

export async function obterClinica(req: AuthRequest, res: Response) {
  const { clinicaId } = req.auth!;
  const clinica = await prisma.clinica.findUnique({
    where: { id: clinicaId },
    include: { _count: { select: { usuarios: true, pacientes: true, profissionais: true, procedimentos: true, convenios: true } } },
  });
  if (!clinica) {
    return res.status(404).json({ error: "Clínica não encontrada" });
  }
  res.json(clinica);
}

export async function atualizarClinica(req: AuthRequest, res: Response) {
  const { clinicaId } = req.auth!;
  const dados = clinicaSchema.partial().parse(req.body);
  const clinica = await prisma.clinica.update({ where: { id: clinicaId }, data: dados });
  res.json(clinica);
}
