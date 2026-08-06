import { Response } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import prisma from "../../config/database";
import { AuthRequest } from "../../middleware/auth";

const profissionalSchema = z.object({
  nome: z.string().min(2, "Nome é obrigatório"),
  cro: z.string().min(2, "CRO é obrigatório"),
  especialidade: z.string().optional().nullable(),
  horarioAtendimento: z.string().optional().nullable(),
  comissao: z.coerce.number().min(0).max(100).optional(),
  email: z.string().email("Email é obrigatório para o profissional"),
  senha: z.string().min(6).optional(),
  cargo: z.enum(["dentista", "recepcionista"]).default("dentista"),
});

function buscarProfissional(id: string, clinicaId: string) {
  return prisma.profissional.findFirst({
    where: { id, clinicaId },
    include: { usuario: { select: { id: true, email: true, cargo: true, ativo: true } } },
  });
}

export async function listarProfissionais(req: AuthRequest, res: Response) {
  const { clinicaId } = req.auth!;
  const { busca } = req.query;
  const profissionais = await prisma.profissional.findMany({
    where: {
      clinicaId,
      ...(typeof busca === "string" && busca.length > 0
        ? { nome: { contains: busca, mode: "insensitive" } }
        : {}),
    },
    include: { usuario: { select: { id: true, email: true, cargo: true, ativo: true } } },
    orderBy: { nome: "asc" },
  });
  res.json(profissionais);
}

export async function criarProfissional(req: AuthRequest, res: Response) {
  const { clinicaId } = req.auth!;
  const dados = profissionalSchema.parse(req.body);

  const emailExiste = await prisma.usuario.findUnique({ where: { email: dados.email } });
  if (emailExiste) {
    return res.status(409).json({ error: "Email já cadastrado" });
  }

  const senhaHash = await bcrypt.hash(dados.senha || "123456", 10);
  const usuario = await prisma.usuario.create({
    data: {
      clinicaId,
      nome: dados.nome,
      email: dados.email,
      senhaHash,
      cargo: dados.cargo,
    },
  });

  const profissional = await prisma.profissional.create({
    data: {
      clinicaId,
      usuarioId: usuario.id,
      nome: dados.nome,
      cro: dados.cro,
      especialidade: dados.especialidade,
      horarioAtendimento: dados.horarioAtendimento,
      comissao: dados.comissao ?? 0,
    },
    include: { usuario: { select: { id: true, email: true, cargo: true, ativo: true } } },
  });

  res.status(201).json(profissional);
}

export async function atualizarProfissional(req: AuthRequest, res: Response) {
  const { clinicaId } = req.auth!;
  const existente = await buscarProfissional(req.params.id, clinicaId);
  if (!existente) {
    return res.status(404).json({ error: "Profissional não encontrado" });
  }

  const dados = profissionalSchema.partial().parse(req.body);

  const profissional = await prisma.profissional.update({
    where: { id: existente.id },
    data: {
      nome: dados.nome,
      cro: dados.cro,
      especialidade: dados.especialidade,
      horarioAtendimento: dados.horarioAtendimento,
      comissao: dados.comissao !== undefined ? dados.comissao : undefined,
      usuario: {
        update: {
          nome: dados.nome,
          ...(dados.email ? { email: dados.email } : {}),
          ...(dados.senha ? { senhaHash: await bcrypt.hash(dados.senha, 10) } : {}),
          ...(dados.cargo ? { cargo: dados.cargo } : {}),
        },
      },
    },
    include: { usuario: { select: { id: true, email: true, cargo: true, ativo: true } } },
  });

  res.json(profissional);
}

export async function excluirProfissional(req: AuthRequest, res: Response) {
  const { clinicaId } = req.auth!;
  const existente = await buscarProfissional(req.params.id, clinicaId);
  if (!existente) {
    return res.status(404).json({ error: "Profissional não encontrado" });
  }

  await prisma.$transaction([
    prisma.usuario.update({ where: { id: existente.usuarioId }, data: { ativo: false } }),
    prisma.profissional.delete({ where: { id: existente.id } }),
  ]);
  res.status(204).send();
}
