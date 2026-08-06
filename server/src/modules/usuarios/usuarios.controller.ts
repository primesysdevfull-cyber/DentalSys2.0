import { Response } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import prisma from "../../config/database";
import { AuthRequest } from "../../middleware/auth";
import { permissoesPorCargo } from "../../config/permissoes";

const usuarioSchema = z.object({
  nome: z.string().min(2),
  email: z.string().email(),
  senha: z.string().min(6).optional(),
  cargo: z.enum(["administrador", "dentista", "recepcionista"]),
});

export async function listarUsuarios(req: AuthRequest, res: Response) {
  const { clinicaId } = req.auth!;
  const usuarios = await prisma.usuario.findMany({
    where: { clinicaId },
    select: {
      id: true,
      nome: true,
      email: true,
      cargo: true,
      ativo: true,
      criadoEm: true,
    },
    orderBy: { nome: "asc" },
  });
  res.json(usuarios);
}

export async function criarUsuario(req: AuthRequest, res: Response) {
  const { clinicaId } = req.auth!;
  const dados = usuarioSchema.parse(req.body);

  const emailExiste = await prisma.usuario.findUnique({ where: { email: dados.email } });
  if (emailExiste) {
    return res.status(409).json({ error: "Email já cadastrado" });
  }

  const usuario = await prisma.usuario.create({
    data: {
      clinicaId,
      nome: dados.nome,
      email: dados.email,
      senhaHash: await bcrypt.hash(dados.senha || "123456", 10),
      cargo: dados.cargo,
    },
    select: { id: true, nome: true, email: true, cargo: true, ativo: true },
  });
  res.status(201).json(usuario);
}

export async function atualizarUsuario(req: AuthRequest, res: Response) {
  const { clinicaId } = req.auth!;
  const dados = usuarioSchema.partial().parse(req.body);

  const existente = await prisma.usuario.findFirst({ where: { id: req.params.id, clinicaId } });
  if (!existente) {
    return res.status(404).json({ error: "Usuário não encontrado" });
  }

  const usuario = await prisma.usuario.update({
    where: { id: existente.id },
    data: {
      nome: dados.nome,
      email: dados.email,
      cargo: dados.cargo,
      ...(dados.senha ? { senhaHash: await bcrypt.hash(dados.senha, 10) } : {}),
    },
    select: { id: true, nome: true, email: true, cargo: true, ativo: true },
  });
  res.json(usuario);
}

export async function alternarAtivo(req: AuthRequest, res: Response) {
  const { clinicaId } = req.auth!;
  const existente = await prisma.usuario.findFirst({ where: { id: req.params.id, clinicaId } });
  if (!existente) {
    return res.status(404).json({ error: "Usuário não encontrado" });
  }
  if (existente.id === req.auth!.userId) {
    return res.status(400).json({ error: "Você não pode desativar seu próprio usuário" });
  }
  const usuario = await prisma.usuario.update({
    where: { id: existente.id },
    data: { ativo: !existente.ativo },
    select: { id: true, nome: true, email: true, cargo: true, ativo: true },
  });
  res.json(usuario);
}

export function me(req: AuthRequest, res: Response) {
  const { userId, email, cargo } = req.auth!;
  res.json({
    id: userId,
    email,
    cargo,
    permissoes: Array.from(permissoesPorCargo[cargo] ?? []),
  });
}
