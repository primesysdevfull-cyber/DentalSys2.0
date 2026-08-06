import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import prisma from "../../config/database";

const registroSchema = z.object({
  clinicaNome: z.string().min(2),
  cnpj: z.string().min(11),
  clinicaEmail: z.string().email(),
  telefone: z.string().optional(),
  usuarioNome: z.string().min(2),
  usuarioEmail: z.string().email(),
  senha: z.string().min(6),
});

const loginSchema = z.object({
  email: z.string().email(),
  senha: z.string().min(1),
});

function gerarToken(userId: string, clinicaId: string, email: string, cargo: string) {
  return jwt.sign(
    { userId, clinicaId, email, cargo },
    process.env.JWT_SECRET || "dev-secret",
    { expiresIn: "12h" }
  );
}

export async function registrar(req: Request, res: Response) {
  const dados = registroSchema.parse(req.body);

  const emailExiste = await prisma.usuario.findUnique({
    where: { email: dados.usuarioEmail },
  });
  if (emailExiste) {
    return res.status(409).json({ error: "Email já cadastrado" });
  }

  const senhaHash = await bcrypt.hash(dados.senha, 10);

  const clinica = await prisma.clinica.create({
    data: {
      nome: dados.clinicaNome,
      cnpj: dados.cnpj,
      email: dados.clinicaEmail,
      telefone: dados.telefone,
    },
  });

  const usuario = await prisma.usuario.create({
    data: {
      clinicaId: clinica.id,
      nome: dados.usuarioNome,
      email: dados.usuarioEmail,
      senhaHash,
      cargo: "administrador",
    },
  });

  res.status(201).json({
    token: gerarToken(usuario.id, clinica.id, usuario.email, usuario.cargo),
    usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email, cargo: usuario.cargo },
    clinica: { id: clinica.id, nome: clinica.nome },
  });
}

export async function login(req: Request, res: Response) {
  const dados = loginSchema.parse(req.body);

  const usuario = await prisma.usuario.findUnique({
    where: { email: dados.email },
  });

  if (!usuario || !(await bcrypt.compare(dados.senha, usuario.senhaHash))) {
    return res.status(401).json({ error: "Email ou senha inválidos" });
  }

  if (!usuario.ativo) {
    return res.status(403).json({ error: "Usuário desativado" });
  }

  res.json({
    token: gerarToken(usuario.id, usuario.clinicaId, usuario.email, usuario.cargo),
    usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email, cargo: usuario.cargo },
  });
}
