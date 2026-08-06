import { Response } from "express";
import { z } from "zod";
import prisma from "../../config/database";
import { AuthRequest } from "../../middleware/auth";

const numeroDente = z.number().int().min(1).max(32);

export const odontogramaDenteSchema = z.object({
  numero: numeroDente,
  condicao: z.enum(["saudavel", "carie", "restauracao", "extraido", "canal", "coroa", "implante", "ausente"]),
  observacao: z.string().max(500).optional().nullable(),
});

export const evolucaoSchema = z.object({
  profissionalId: z.string().uuid(),
  descricao: z.string().min(3, "Descrição muito curta").max(4000),
  conduta: z.string().max(4000).optional().nullable(),
  data: z.string().datetime().optional().nullable(),
});

export const receituarioSchema = z.object({
  profissionalId: z.string().uuid(),
  medicamentos: z.array(
    z.object({
      nome: z.string().min(1).max(200),
      posologia: z.string().max(500),
      quantidade: z.string().max(100).optional().nullable(),
    })
  ).min(1, "Informe pelo menos um medicamento"),
  instrucoes: z.string().max(2000).optional().nullable(),
  assinatura: z.string().max(200).optional().nullable(),
});

export const exameSchema = z.object({
  tipo: z.enum(["imagem", "laudo"]),
  descricao: z.string().max(500).optional().nullable(),
});

export const termoConsentimentoSchema = z.object({
  titulo: z.string().min(3, "Informe o título do termo").max(200),
  conteudo: z.string().min(10, "O conteúdo do termo está muito curto").max(10000),
  assinado: z.boolean().optional(),
  dataAssinatura: z.string().datetime().optional().nullable(),
  profissionalId: z.string().uuid().optional().nullable(),
});

async function pacienteDaClinica(pacienteId: string, clinicaId: string) {
  const paciente = await prisma.paciente.findFirst({
    where: { id: pacienteId, clinicaId },
    select: { id: true },
  });
  return paciente;
}

async function profissionalDaClinica(profissionalId: string, clinicaId: string) {
  const profissional = await prisma.profissional.findFirst({
    where: { id: profissionalId, clinicaId },
    select: { id: true, nome: true, cro: true },
  });
  return profissional;
}

export async function obterOdontograma(req: AuthRequest, res: Response) {
  const { clinicaId } = req.auth!;
  const paciente = await pacienteDaClinica(req.params.pacienteId, clinicaId);

  if (!paciente) {
    return res.status(404).json({ error: "Paciente não encontrado" });
  }

  const dentes = await prisma.odontogramaDente.findMany({
    where: { pacienteId: paciente.id, clinicaId },
    orderBy: { numero: "asc" },
  });

  const mapa: Record<number, { condicao: string; observacao: string | null; atualizadoEm: string }> = {};
  for (const dente of dentes) {
    mapa[dente.numero] = {
      condicao: dente.condicao,
      observacao: dente.observacao,
      atualizadoEm: dente.atualizadoEm.toISOString(),
    };
  }

  res.json({ pacienteId: paciente.id, dentes: mapa });
}

export async function atualizarOdontograma(req: AuthRequest, res: Response) {
  const { clinicaId } = req.auth!;
  const paciente = await pacienteDaClinica(req.params.pacienteId, clinicaId);

  if (!paciente) {
    return res.status(404).json({ error: "Paciente não encontrado" });
  }

  const dados = odontogramaDenteSchema.parse(req.body);

  const dente = await prisma.odontogramaDente.upsert({
    where: {
      pacienteId_numero: { pacienteId: paciente.id, numero: dados.numero },
    },
    create: {
      clinicaId,
      pacienteId: paciente.id,
      numero: dados.numero,
      condicao: dados.condicao,
      observacao: dados.observacao ?? null,
    },
    update: {
      condicao: dados.condicao,
      observacao: dados.observacao ?? null,
    },
  });

  res.json(dente);
}

export async function resetarOdontograma(req: AuthRequest, res: Response) {
  const { clinicaId } = req.auth!;
  const paciente = await pacienteDaClinica(req.params.pacienteId, clinicaId);

  if (!paciente) {
    return res.status(404).json({ error: "Paciente não encontrado" });
  }

  await prisma.odontogramaDente.deleteMany({
    where: { pacienteId: paciente.id, clinicaId },
  });

  res.status(204).send();
}

export async function listarEvolucoes(req: AuthRequest, res: Response) {
  const { clinicaId } = req.auth!;
  const paciente = await pacienteDaClinica(req.params.pacienteId, clinicaId);

  if (!paciente) {
    return res.status(404).json({ error: "Paciente não encontrado" });
  }

  const evolucoes = await prisma.evolucao.findMany({
    where: { pacienteId: paciente.id, clinicaId },
    orderBy: { criadoEm: "desc" },
    include: { profissional: { select: { id: true, nome: true, especialidade: true } } },
  });

  res.json(evolucoes.map((e) => ({
    id: e.id,
    descricao: e.descricao,
    conduta: e.conduta,
    criadoEm: e.criadoEm.toISOString(),
    profissional: e.profissional,
  })));
}

export async function criarEvolucao(req: AuthRequest, res: Response) {
  const { clinicaId } = req.auth!;
  const paciente = await pacienteDaClinica(req.params.pacienteId, clinicaId);

  if (!paciente) {
    return res.status(404).json({ error: "Paciente não encontrado" });
  }

  const dados = evolucaoSchema.parse(req.body);
  const profissional = await profissionalDaClinica(dados.profissionalId, clinicaId);

  if (!profissional) {
    return res.status(404).json({ error: "Profissional não encontrado" });
  }

  const data = dados.data ? new Date(dados.data) : new Date();
  const evolucao = await prisma.evolucao.create({
    data: {
      clinicaId,
      pacienteId: paciente.id,
      profissionalId: profissional.id,
      descricao: dados.descricao,
      conduta: dados.conduta ?? null,
      criadoEm: data,
    },
    include: { profissional: { select: { id: true, nome: true, especialidade: true } } },
  });

  res.status(201).json({
    id: evolucao.id,
    descricao: evolucao.descricao,
    conduta: evolucao.conduta,
    criadoEm: evolucao.criadoEm.toISOString(),
    profissional: evolucao.profissional,
  });
}

export async function excluirEvolucao(req: AuthRequest, res: Response) {
  const { clinicaId } = req.auth!;
  const evolucao = await prisma.evolucao.findFirst({
    where: { id: req.params.evolucaoId, clinicaId },
    select: { id: true },
  });

  if (!evolucao) {
    return res.status(404).json({ error: "Evolução não encontrada" });
  }

  await prisma.evolucao.delete({ where: { id: evolucao.id } });
  res.status(204).send();
}

export async function listarExames(req: AuthRequest, res: Response) {
  const { clinicaId } = req.auth!;
  const paciente = await pacienteDaClinica(req.params.pacienteId, clinicaId);

  if (!paciente) {
    return res.status(404).json({ error: "Paciente não encontrado" });
  }

  const exames = await prisma.exame.findMany({
    where: { pacienteId: paciente.id, clinicaId },
    orderBy: { criadoEm: "desc" },
  });

  res.json(exames.map((e) => ({
    id: e.id,
    tipo: e.tipo,
    descricao: e.descricao,
    arquivoUrl: e.arquivoUrl,
    arquivoNome: e.arquivoNome,
    criadoEm: e.criadoEm.toISOString(),
  })));
}

export async function criarExame(req: AuthRequest, res: Response) {
  const { clinicaId } = req.auth!;
  const paciente = await pacienteDaClinica(req.params.pacienteId, clinicaId);

  if (!paciente) {
    return res.status(404).json({ error: "Paciente não encontrado" });
  }

  const dados = exameSchema.parse(req.body);
  const arquivo = (req as any).file as Express.Multer.File | undefined;

  if (dados.tipo === "imagem" && !arquivo) {
    return res.status(400).json({ error: "Informe um arquivo de imagem" });
  }

  const exame = await prisma.exame.create({
    data: {
      clinicaId,
      pacienteId: paciente.id,
      tipo: dados.tipo,
      descricao: dados.descricao ?? null,
      arquivoUrl: arquivo ? `/uploads/${arquivo.filename}` : null,
      arquivoNome: arquivo ? arquivo.originalname : null,
    },
  });

  res.status(201).json({
    id: exame.id,
    tipo: exame.tipo,
    descricao: exame.descricao,
    arquivoUrl: exame.arquivoUrl,
    arquivoNome: exame.arquivoNome,
    criadoEm: exame.criadoEm.toISOString(),
  });
}

export async function excluirExame(req: AuthRequest, res: Response) {
  const { clinicaId } = req.auth!;
  const exame = await prisma.exame.findFirst({
    where: { id: req.params.exameId, clinicaId },
    select: { id: true },
  });

  if (!exame) {
    return res.status(404).json({ error: "Exame não encontrado" });
  }

  await prisma.exame.delete({ where: { id: exame.id } });
  res.status(204).send();
}

export async function listarReceituarios(req: AuthRequest, res: Response) {
  const { clinicaId } = req.auth!;
  const paciente = await pacienteDaClinica(req.params.pacienteId, clinicaId);

  if (!paciente) {
    return res.status(404).json({ error: "Paciente não encontrado" });
  }

  const receituarios = await prisma.receituario.findMany({
    where: { pacienteId: paciente.id, clinicaId },
    orderBy: { criadoEm: "desc" },
    include: { profissional: { select: { id: true, nome: true, cro: true } } },
  });

  res.json(receituarios.map((r) => ({
    id: r.id,
    medicamentos: JSON.parse(r.medicamentos) as Array<{ nome: string; posologia: string; quantidade: string | null }>,
    instrucoes: r.instrucoes,
    assinatura: r.assinatura,
    criadoEm: r.criadoEm.toISOString(),
    profissional: r.profissional,
  })));
}

export async function criarReceituario(req: AuthRequest, res: Response) {
  const { clinicaId } = req.auth!;
  const paciente = await pacienteDaClinica(req.params.pacienteId, clinicaId);

  if (!paciente) {
    return res.status(404).json({ error: "Paciente não encontrado" });
  }

  const dados = receituarioSchema.parse(req.body);
  const profissional = await profissionalDaClinica(dados.profissionalId, clinicaId);

  if (!profissional) {
    return res.status(404).json({ error: "Profissional não encontrado" });
  }

  const receituario = await prisma.receituario.create({
    data: {
      clinicaId,
      pacienteId: paciente.id,
      profissionalId: profissional.id,
      medicamentos: JSON.stringify(dados.medicamentos),
      instrucoes: dados.instrucoes ?? null,
      assinatura: dados.assinatura ?? null,
    },
    include: { profissional: { select: { id: true, nome: true, cro: true } } },
  });

  res.status(201).json({
    id: receituario.id,
    medicamentos: JSON.parse(receituario.medicamentos),
    instrucoes: receituario.instrucoes,
    assinatura: receituario.assinatura,
    criadoEm: receituario.criadoEm.toISOString(),
    profissional: receituario.profissional,
  });
}

export async function excluirReceituario(req: AuthRequest, res: Response) {
  const { clinicaId } = req.auth!;
  const receituario = await prisma.receituario.findFirst({
    where: { id: req.params.receituarioId, clinicaId },
    select: { id: true },
  });

  if (!receituario) {
    return res.status(404).json({ error: "Receituário não encontrado" });
  }

  await prisma.receituario.delete({ where: { id: receituario.id } });
  res.status(204).send();
}

export async function listarTermos(req: AuthRequest, res: Response) {
  const { clinicaId } = req.auth!;
  const paciente = await pacienteDaClinica(req.params.pacienteId, clinicaId);

  if (!paciente) {
    return res.status(404).json({ error: "Paciente não encontrado" });
  }

  const termos = await prisma.termoConsentimento.findMany({
    where: { pacienteId: paciente.id, clinicaId },
    orderBy: { criadoEm: "desc" },
    include: { profissional: { select: { id: true, nome: true, cro: true } } },
  });

  res.json(
    termos.map((t) => ({
      id: t.id,
      titulo: t.titulo,
      conteudo: t.conteudo,
      assinado: t.assinado,
      dataAssinatura: t.dataAssinatura?.toISOString() ?? null,
      criadoEm: t.criadoEm.toISOString(),
      profissional: t.profissional,
    }))
  );
}

export async function criarTermo(req: AuthRequest, res: Response) {
  const { clinicaId } = req.auth!;
  const dados = termoConsentimentoSchema.parse(req.body as object);
  const paciente = await pacienteDaClinica(req.params.pacienteId, clinicaId);

  if (!paciente) {
    return res.status(404).json({ error: "Paciente não encontrado" });
  }

  if (dados.profissionalId) {
    const profissional = await profissionalDaClinica(dados.profissionalId, clinicaId);
    if (!profissional) {
      return res.status(400).json({ error: "Profissional não pertence à clínica" });
    }
  }

  const termo = await prisma.termoConsentimento.create({
    data: {
      clinicaId,
      pacienteId: paciente.id,
      profissionalId: dados.profissionalId ?? null,
      titulo: dados.titulo,
      conteudo: dados.conteudo,
      assinado: dados.assinado ?? false,
      dataAssinatura: dados.dataAssinatura ? new Date(dados.dataAssinatura) : (dados.assinado ? new Date() : null),
    },
    include: { profissional: { select: { id: true, nome: true, cro: true } } },
  });

  res.status(201).json({
    id: termo.id,
    titulo: termo.titulo,
    conteudo: termo.conteudo,
    assinado: termo.assinado,
    dataAssinatura: termo.dataAssinatura?.toISOString() ?? null,
    criadoEm: termo.criadoEm.toISOString(),
    profissional: termo.profissional,
  });
}

export async function assinarTermo(req: AuthRequest, res: Response) {
  const { clinicaId } = req.auth!;
  const termo = await prisma.termoConsentimento.findFirst({
    where: { id: req.params.termoId, clinicaId },
    select: { id: true },
  });

  if (!termo) {
    return res.status(404).json({ error: "Termo não encontrado" });
  }

  const atualizado = await prisma.termoConsentimento.update({
    where: { id: termo.id },
    data: { assinado: true, dataAssinatura: new Date() },
    include: { profissional: { select: { id: true, nome: true, cro: true } } },
  });

  res.json({
    id: atualizado.id,
    titulo: atualizado.titulo,
    conteudo: atualizado.conteudo,
    assinado: atualizado.assinado,
    dataAssinatura: atualizado.dataAssinatura?.toISOString() ?? null,
    criadoEm: atualizado.criadoEm.toISOString(),
    profissional: atualizado.profissional,
  });
}

export async function excluirTermo(req: AuthRequest, res: Response) {
  const { clinicaId } = req.auth!;
  const termo = await prisma.termoConsentimento.findFirst({
    where: { id: req.params.termoId, clinicaId },
    select: { id: true },
  });

  if (!termo) {
    return res.status(404).json({ error: "Termo não encontrado" });
  }

  await prisma.termoConsentimento.delete({ where: { id: termo.id } });
  res.status(204).send();
}
