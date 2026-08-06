import { Response } from "express";
import { z } from "zod";
import prisma from "../../config/database";
import { AuthRequest } from "../../middleware/auth";
import { enviarMensagem, envioConfigurado } from "../../config/mensagens";
import { preencherTemplate } from "../mensagens/mensagens.controller";

const STATUS_FLUXO = ["agendado", "confirmado", "atendido", "faltou", "cancelado", "bloqueado"] as const;
type StatusValido = (typeof STATUS_FLUXO)[number];

function ehStatus(v: unknown): v is StatusValido {
  return typeof v === "string" && (STATUS_FLUXO as readonly string[]).includes(v);
}

const agendamentoSchema = z.object({
  pacienteId: z.string().optional().nullable(),
  profissionalId: z.string().min(1, "Profissional é obrigatório"),
  salaId: z.string().optional().nullable(),
  procedimentoId: z.string().optional().nullable(),
  dataHora: z.coerce.date(),
  duracaoMin: z.coerce.number().int().min(1).optional(),
  status: z.string().optional().refine((v) => v === undefined || ehStatus(v), "Status inválido"),
  observacoes: z.string().optional().nullable(),
  ehRetorno: z.boolean().optional(),
});

function sobrepoe(inicioA: Date, fimA: Date, inicioB: Date, fimB: Date): boolean {
  return inicioA < fimB && inicioB < fimA;
}

async function verificarConflito(
  clinicaId: string,
  profissionalId: string,
  salaId: string | null | undefined,
  inicio: Date,
  fim: Date,
  ignorarId?: string
) {
  const agendamentos = await prisma.agendamento.findMany({
    where: {
      clinicaId,
      status: { notIn: ["cancelado"] },
      NOT: ignorarId ? { id: ignorarId } : undefined,
      OR: [
        { profissionalId },
        ...(salaId ? [{ salaId }] : []),
      ],
    },
  });

  for (const ag of agendamentos) {
    const agInicio = new Date(ag.dataHora);
    const agFim = new Date(agInicio.getTime() + ag.duracaoMin * 60000);
    if (sobrepoe(inicio, fim, agInicio, agFim)) {
      const conflito = ag.profissionalId === profissionalId ? "profissional" : "sala";
      return `Conflito de horário com outro agendamento (${conflito}) para este período.`;
    }
  }
  return null;
}

export async function listarAgenda(req: AuthRequest, res: Response) {
  const { clinicaId } = req.auth!;
  const inicio = req.query.inicio ? new Date(String(req.query.inicio)) : null;
  const fim = req.query.fim ? new Date(String(req.query.fim)) : null;
  const profissionalId = req.query.profissionalId ? String(req.query.profissionalId) : undefined;
  const salaId = req.query.salaId ? String(req.query.salaId) : undefined;

  const agendamentos = await prisma.agendamento.findMany({
    where: {
      clinicaId,
      profissionalId,
      salaId,
      dataHora: inicio && fim ? { gte: inicio, lte: fim } : undefined,
    },
    include: {
      paciente: { select: { id: true, nome: true, telefone: true, whatsapp: true } },
      profissional: { select: { id: true, nome: true, especialidade: true } },
      sala: { select: { id: true, nome: true } },
      procedimento: { select: { id: true, nome: true, duracaoMedia: true } },
    },
    orderBy: { dataHora: "asc" },
  });
  res.json(agendamentos);
}

export async function obterAgendamento(req: AuthRequest, res: Response) {
  const { clinicaId } = req.auth!;
  const agendamento = await prisma.agendamento.findFirst({
    where: { id: req.params.id, clinicaId },
    include: {
      paciente: { select: { id: true, nome: true, telefone: true, whatsapp: true } },
      profissional: { select: { id: true, nome: true } },
      sala: { select: { id: true, nome: true } },
      procedimento: { select: { id: true, nome: true, duracaoMedia: true } },
      origem: { select: { id: true, dataHora: true } },
    },
  });
  if (!agendamento) {
    return res.status(404).json({ error: "Agendamento não encontrado" });
  }
  res.json(agendamento);
}

export async function criarAgendamento(req: AuthRequest, res: Response) {
  const { clinicaId } = req.auth!;
  const dados = agendamentoSchema.parse(req.body);

  if (dados.pacienteId && dados.status !== "bloqueado") {
    const paciente = await prisma.paciente.findFirst({
      where: { id: dados.pacienteId, clinicaId },
    });
    if (!paciente) {
      return res.status(404).json({ error: "Paciente não encontrado" });
    }
  }

  const profissional = await prisma.profissional.findFirst({
    where: { id: dados.profissionalId, clinicaId },
  });
  if (!profissional) {
    return res.status(404).json({ error: "Profissional não encontrado" });
  }

  if (dados.salaId) {
    const sala = await prisma.sala.findFirst({ where: { id: dados.salaId, clinicaId } });
    if (!sala) {
      return res.status(404).json({ error: "Sala não encontrada" });
    }
  }

  let duracao = dados.duracaoMin;
  if (duracao === undefined && dados.procedimentoId) {
    const procedimento = await prisma.procedimento.findFirst({
      where: { id: dados.procedimentoId, clinicaId },
    });
    duracao = procedimento?.duracaoMedia;
  }

  const inicio = new Date(dados.dataHora);
  const fim = new Date(inicio.getTime() + (duracao ?? 30) * 60000);

  const conflito = await verificarConflito(clinicaId, dados.profissionalId, dados.salaId, inicio, fim);
  if (conflito) {
    return res.status(409).json({ error: conflito });
  }

  const agendamento = await prisma.agendamento.create({
    data: {
      clinicaId,
      pacienteId: dados.status === "bloqueado" ? null : dados.pacienteId ?? null,
      profissionalId: dados.profissionalId,
      salaId: dados.salaId ?? null,
      procedimentoId: dados.procedimentoId ?? null,
      dataHora: inicio,
      duracaoMin: duracao ?? 30,
      status: (dados.status as StatusValido) ?? "agendado",
      observacoes: dados.observacoes ?? null,
      ehRetorno: dados.ehRetorno ?? false,
    },
  });
  res.status(201).json(agendamento);
}

export async function atualizarAgendamento(req: AuthRequest, res: Response) {
  const { clinicaId } = req.auth!;
  const existente = await prisma.agendamento.findFirst({ where: { id: req.params.id, clinicaId } });
  if (!existente) {
    return res.status(404).json({ error: "Agendamento não encontrado" });
  }

  const dados = agendamentoSchema.partial().parse(req.body);
  const dataHora = dados.dataHora ? new Date(dados.dataHora) : new Date(existente.dataHora);
  const duracaoMin = dados.duracaoMin ?? existente.duracaoMin;
  const inicio = dataHora;
  const fim = new Date(inicio.getTime() + duracaoMin * 60000);

  const conflito = await verificarConflito(
    clinicaId,
    dados.profissionalId ?? existente.profissionalId,
    dados.salaId !== undefined ? dados.salaId : existente.salaId,
    inicio,
    fim,
    existente.id
  );
  if (conflito) {
    return res.status(409).json({ error: conflito });
  }

  const agendamento = await prisma.agendamento.update({
    where: { id: existente.id },
    data: {
      pacienteId: dados.pacienteId !== undefined ? dados.pacienteId : undefined,
      profissionalId: dados.profissionalId,
      salaId: dados.salaId !== undefined ? dados.salaId : undefined,
      procedimentoId: dados.procedimentoId !== undefined ? dados.procedimentoId : undefined,
      dataHora: dados.dataHora ? inicio : undefined,
      duracaoMin: dados.duracaoMin,
      status: dados.status as StatusValido | undefined,
      observacoes: dados.observacoes !== undefined ? dados.observacoes : undefined,
      ehRetorno: dados.ehRetorno,
    },
  });
  res.json(agendamento);
}

const statusSchema = z.object({
  status: z.string().refine(ehStatus, "Status inválido"),
});

const TRANSICOES: Record<string, string[]> = {
  agendado: ["confirmado", "cancelado"],
  confirmado: ["atendido", "faltou", "cancelado"],
  atendido: [],
  faltou: ["agendado"],
  cancelado: [],
  bloqueado: ["cancelado"],
};

export async function mudarStatus(req: AuthRequest, res: Response) {
  const { clinicaId } = req.auth!;
  const { status } = statusSchema.parse(req.body);

  const agendamento = await prisma.agendamento.findFirst({
    where: { id: req.params.id, clinicaId },
  });
  if (!agendamento) {
    return res.status(404).json({ error: "Agendamento não encontrado" });
  }

  if (agendamento.status === status) {
    return res.json(agendamento);
  }

  const permitidas = TRANSICOES[agendamento.status] ?? [];
  if (!permitidas.includes(status)) {
    return res
      .status(400)
      .json({ error: `Não é possível mudar de "${agendamento.status}" para "${status}".` });
  }

  const atualizado = await prisma.agendamento.update({
    where: { id: agendamento.id },
    data: { status: status as StatusValido },
  });
  res.json(atualizado);
}

export async function enviarConfirmacao(req: AuthRequest, res: Response) {
  const { clinicaId } = req.auth!;
  const agendamento = await prisma.agendamento.findFirst({
    where: { id: req.params.id, clinicaId },
    include: {
      paciente: { select: { nome: true, whatsapp: true, telefone: true } },
      profissional: { select: { nome: true } },
      procedimento: { select: { nome: true } },
    },
  });
  if (!agendamento) {
    return res.status(404).json({ error: "Agendamento não encontrado" });
  }
  if (!agendamento.paciente) {
    return res.status(400).json({ error: "Agendamento sem paciente" });
  }

  const contato = agendamento.paciente.whatsapp || agendamento.paciente.telefone;
  if (!contato) {
    return res.status(400).json({ error: "Paciente sem contato cadastrado" });
  }

  const dataFormatada = new Date(agendamento.dataHora).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });

  const clinica = await prisma.clinica.findUnique({
    where: { id: clinicaId },
    select: { nome: true },
  });

  const template = await prisma.mensagemTemplate.findUnique({
    where: { clinicaId_tipo: { clinicaId, tipo: "confirmacao" } },
  });

  const mensagem = template && template.ativo
    ? preencherTemplate(template.texto, {
        paciente: agendamento.paciente.nome,
        data: dataFormatada.split(", ")[0],
        hora: dataFormatada.split(", ")[1],
        profissional: agendamento.profissional?.nome,
        procedimento: agendamento.procedimento?.nome,
        clinica: clinica?.nome,
      })
    : `Olá, ${agendamento.paciente.nome}! Confirmamos seu atendimento com ${agendamento.profissional.nome}` +
      `${agendamento.procedimento ? ` (${agendamento.procedimento.nome})` : ""}` +
      ` em ${dataFormatada}. Até lá! 🦷`;

  const resultado = await enviarMensagem(contato, mensagem);

  const atualizado = await prisma.agendamento.update({
    where: { id: agendamento.id },
    data: { confirmacaoEnviada: true, status: "confirmado" },
  });

  res.json({
    ...atualizado,
    mensagemEnviada: mensagem,
    contato,
    envio: {
      enviado: resultado.enviado,
      metodo: resultado.metodo,
      ...(envioConfigurado() ? {} : { atencao: "Provedor de WhatsApp não configurado (WHATSAPP_API_URL). Ativação simulada." }),
    },
  });
}

export async function bloquearHorario(req: AuthRequest, res: Response) {
  const { clinicaId } = req.auth!;
  const dados = agendamentoSchema.partial().parse(req.body);

  if (!dados.profissionalId) {
    return res.status(400).json({ error: "Profissional é obrigatório" });
  }
  if (!dados.dataHora) {
    return res.status(400).json({ error: "Data e horário são obrigatórios" });
  }

  const profissional = await prisma.profissional.findFirst({
    where: { id: dados.profissionalId, clinicaId },
  });
  if (!profissional) {
    return res.status(404).json({ error: "Profissional não encontrado" });
  }

  const inicio = new Date(dados.dataHora);
  const fim = new Date(inicio.getTime() + (dados.duracaoMin ?? 30) * 60000);

  const conflito = await verificarConflito(clinicaId, dados.profissionalId, dados.salaId, inicio, fim);
  if (conflito) {
    return res.status(409).json({ error: conflito });
  }

  const bloqueio = await prisma.agendamento.create({
    data: {
      clinicaId,
      pacienteId: null,
      profissionalId: dados.profissionalId,
      salaId: dados.salaId ?? null,
      dataHora: inicio,
      duracaoMin: dados.duracaoMin ?? 30,
      status: "bloqueado",
      observacoes: dados.observacoes ?? "Horário bloqueado",
    },
  });
  res.status(201).json(bloqueio);
}

export async function marcarRetorno(req: AuthRequest, res: Response) {
  const { clinicaId } = req.auth!;
  const origem = await prisma.agendamento.findFirst({
    where: { id: req.params.id, clinicaId, pacienteId: { not: null } },
  });
  if (!origem) {
    return res.status(404).json({ error: "Agendamento de origem não encontrado" });
  }

  const dados = agendamentoSchema.partial().parse(req.body);

  if (!dados.dataHora) {
    return res.status(400).json({ error: "Data e horário do retorno são obrigatórios" });
  }

  const inicio = new Date(dados.dataHora);
  const fim = new Date(inicio.getTime() + (dados.duracaoMin ?? origem.duracaoMin) * 60000);

  const conflito = await verificarConflito(
    clinicaId,
    origem.profissionalId,
    dados.salaId ?? origem.salaId,
    inicio,
    fim
  );
  if (conflito) {
    return res.status(409).json({ error: conflito });
  }

  const retorno = await prisma.agendamento.create({
    data: {
      clinicaId,
      pacienteId: origem.pacienteId,
      profissionalId: origem.profissionalId,
      salaId: dados.salaId ?? origem.salaId,
      procedimentoId: dados.procedimentoId ?? origem.procedimentoId,
      dataHora: inicio,
      duracaoMin: dados.duracaoMin ?? origem.duracaoMin,
      status: "agendado",
      observacoes: dados.observacoes ?? `Retorno de atendimento de ${new Date(origem.dataHora).toLocaleDateString("pt-BR")}`,
      ehRetorno: true,
      agendamentoOrigemId: origem.id,
    },
  });
  res.status(201).json(retorno);
}

export async function historicoAtendimentos(req: AuthRequest, res: Response) {
  const { clinicaId } = req.auth!;
  const pacienteId = req.query.pacienteId ? String(req.query.pacienteId) : undefined;

  const atendimentos = await prisma.agendamento.findMany({
    where: {
      clinicaId,
      pacienteId,
      status: { in: ["atendido", "faltou"] },
    },
    include: {
      paciente: { select: { id: true, nome: true } },
      profissional: { select: { id: true, nome: true } },
      procedimento: { select: { id: true, nome: true } },
      sala: { select: { id: true, nome: true } },
    },
    orderBy: { dataHora: "desc" },
  });
  res.json(atendimentos);
}

export async function excluirAgendamento(req: AuthRequest, res: Response) {
  const { clinicaId } = req.auth!;
  const existente = await prisma.agendamento.findFirst({ where: { id: req.params.id, clinicaId } });
  if (!existente) {
    return res.status(404).json({ error: "Agendamento não encontrado" });
  }
  await prisma.agendamento.delete({ where: { id: existente.id } });
  res.status(204).send();
}
