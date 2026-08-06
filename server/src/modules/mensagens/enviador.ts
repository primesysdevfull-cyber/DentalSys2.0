import prisma from "../../config/database";
import { enviarMensagem, envioConfigurado } from "../../config/mensagens";
import { preencherTemplate } from "./mensagens.controller";

type TipoEnvio = "lembrete" | "retorno" | "aniversario";

async function obterConfig(clinicaId: string) {
  const config = await prisma.configMensagem.findUnique({ where: { clinicaId } });
  if (config) return config;
  return prisma.configMensagem.create({
    data: { clinicaId },
  });
}

async function templateAtivo(clinicaId: string, tipo: TipoEnvio) {
  const template = await prisma.mensagemTemplate.findUnique({
    where: { clinicaId_tipo: { clinicaId, tipo } },
    select: { texto: true, ativo: true },
  });
  return template?.ativo ? template.texto : null;
}

function contatoPaciente(paciente: { whatsapp?: string | null; telefone?: string | null }) {
  return paciente.whatsapp || paciente.telefone || null;
}

function dataFormatada(d: Date): string {
  return new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

async function registrarEnvio(dados: {
  clinicaId: string;
  pacienteId?: string | null;
  agendamentoId?: string | null;
  tipo: TipoEnvio;
  contato: string;
  texto: string;
  enviado: boolean;
  metodo: string;
  detalhe?: string;
}) {
  await prisma.mensagemEnviada.create({ data: dados });
}

async function dispararLembretes(clinicaId: string, config: { antecedenciaMin: number }) {
  const texto = await templateAtivo(clinicaId, "lembrete");
  if (!texto) return 0;

  const agora = new Date();
  const janelaFim = new Date(agora.getTime() + config.antecedenciaMin * 60000);

  const agendamentos = await prisma.agendamento.findMany({
    where: {
      clinicaId,
      status: { in: ["agendado", "confirmado"] },
      lembreteEnviado: false,
      dataHora: { gt: agora, lte: janelaFim },
      paciente: { isNot: null },
    },
    include: {
      paciente: { select: { id: true, nome: true, whatsapp: true, telefone: true } },
      profissional: { select: { nome: true } },
      procedimento: { select: { nome: true } },
    },
  });

  const clinica = await prisma.clinica.findUnique({
    where: { id: clinicaId },
    select: { nome: true },
  });

  let enviados = 0;
  for (const ag of agendamentos) {
    const contato = contatoPaciente(ag.paciente!);
    if (!contato) continue;

    const mensagem = preencherTemplate(texto, {
      paciente: ag.paciente!.nome,
      data: dataFormatada(ag.dataHora).split(", ")[0],
      hora: dataFormatada(ag.dataHora).split(", ")[1],
      profissional: ag.profissional?.nome,
      procedimento: ag.procedimento?.nome,
      clinica: clinica?.nome,
    });

    const resultado = await enviarMensagem(contato, mensagem);
    await prisma.agendamento.update({
      where: { id: ag.id },
      data: { lembreteEnviado: true },
    });
    await registrarEnvio({
      clinicaId,
      pacienteId: ag.paciente!.id,
      agendamentoId: ag.id,
      tipo: "lembrete",
      contato,
      texto: mensagem,
      enviado: resultado.enviado,
      metodo: resultado.metodo,
      detalhe: resultado.detalhe,
    });
    enviados += 1;
  }
  return enviados;
}

async function dispararRetornos(clinicaId: string) {
  const texto = await templateAtivo(clinicaId, "retorno");
  if (!texto) return 0;

  const agora = new Date();
  const agendamentos = await prisma.agendamento.findMany({
    where: {
      clinicaId,
      ehRetorno: true,
      status: { in: ["agendado", "confirmado"] },
      dataHora: { lt: agora },
      paciente: { isNot: null },
    },
    include: {
      paciente: { select: { id: true, nome: true, whatsapp: true, telefone: true } },
      profissional: { select: { nome: true } },
      procedimento: { select: { nome: true } },
    },
  });

  const clinica = await prisma.clinica.findUnique({
    where: { id: clinicaId },
    select: { nome: true },
  });

  let enviados = 0;
  for (const ag of agendamentos) {
    const jaEnviado = await prisma.mensagemEnviada.findFirst({
      where: { clinicaId, agendamentoId: ag.id, tipo: "retorno" },
      select: { id: true },
    });
    if (jaEnviado) continue;

    const contato = contatoPaciente(ag.paciente!);
    if (!contato) continue;

    const mensagem = preencherTemplate(texto, {
      paciente: ag.paciente!.nome,
      data: dataFormatada(ag.dataHora).split(", ")[0],
      hora: dataFormatada(ag.dataHora).split(", ")[1],
      profissional: ag.profissional?.nome,
      procedimento: ag.procedimento?.nome,
      clinica: clinica?.nome,
    });

    const resultado = await enviarMensagem(contato, mensagem);
    await registrarEnvio({
      clinicaId,
      pacienteId: ag.paciente!.id,
      agendamentoId: ag.id,
      tipo: "retorno",
      contato,
      texto: mensagem,
      enviado: resultado.enviado,
      metodo: resultado.metodo,
      detalhe: resultado.detalhe,
    });
    enviados += 1;
  }
  return enviados;
}

async function dispararAniversarios(clinicaId: string) {
  const texto = await templateAtivo(clinicaId, "aniversario");
  if (!texto) return 0;

  const hoje = new Date();
  const mesHoje = hoje.getMonth() + 1;
  const diaHoje = hoje.getDate();
  const inicioDoDia = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());

  const pacientes = await prisma.paciente.findMany({
    where: {
      clinicaId,
      status: "ativo",
      dataNascimento: { not: null },
    },
    select: {
      id: true,
      nome: true,
      whatsapp: true,
      telefone: true,
      dataNascimento: true,
    },
  });

  const clinica = await prisma.clinica.findUnique({
    where: { id: clinicaId },
    select: { nome: true },
  });

  let enviados = 0;
  for (const paciente of pacientes) {
    const nasc = paciente.dataNascimento!;
    if (nasc.getMonth() + 1 !== mesHoje || nasc.getDate() !== diaHoje) continue;

    const jaEnviado = await prisma.mensagemEnviada.findFirst({
      where: {
        clinicaId,
        pacienteId: paciente.id,
        tipo: "aniversario",
        criadoEm: { gte: inicioDoDia },
      },
      select: { id: true },
    });
    if (jaEnviado) continue;

    const contato = contatoPaciente(paciente);
    if (!contato) continue;

    const mensagem = preencherTemplate(texto, {
      paciente: paciente.nome,
      clinica: clinica?.nome,
    });

    const resultado = await enviarMensagem(contato, mensagem);
    await registrarEnvio({
      clinicaId,
      pacienteId: paciente.id,
      tipo: "aniversario",
      contato,
      texto: mensagem,
      enviado: resultado.enviado,
      metodo: resultado.metodo,
      detalhe: resultado.detalhe,
    });
    enviados += 1;
  }
  return enviados;
}

export async function executarDisparosAutomaticos(): Promise<{
  clinicas: number;
  lembretes: number;
  retornos: number;
  aniversarios: number;
  configurado: boolean;
}> {
  const clinicas = await prisma.clinica.findMany({
    where: { ativa: true },
    select: { id: true },
  });

  let lembretes = 0;
  let retornos = 0;
  let aniversarios = 0;

  for (const clinica of clinicas) {
    const config = await obterConfig(clinica.id);
    if (config.ativoLembrete) lembretes += await dispararLembretes(clinica.id, config);
    if (config.ativoRetorno) retornos += await dispararRetornos(clinica.id);
    if (config.ativoAniversario) aniversarios += await dispararAniversarios(clinica.id);
  }

  return {
    clinicas: clinicas.length,
    lembretes,
    retornos,
    aniversarios,
    configurado: envioConfigurado(),
  };
}

export async function listarEnvios(clinicaId: string, tipo?: string, limite = 50) {
  return prisma.mensagemEnviada.findMany({
    where: {
      clinicaId,
      ...(tipo ? { tipo } : {}),
    },
    orderBy: { criadoEm: "desc" },
    take: limite,
    include: { paciente: { select: { nome: true } } },
  });
}

export async function obterConfigMensagem(clinicaId: string) {
  return obterConfig(clinicaId);
}

export async function salvarConfigMensagem(
  clinicaId: string,
  dados: { antecedenciaMin?: number; ativoLembrete?: boolean; ativoRetorno?: boolean; ativoAniversario?: boolean }
) {
  const existente = await prisma.configMensagem.findUnique({ where: { clinicaId } });
  if (existente) {
    return prisma.configMensagem.update({
      where: { clinicaId },
      data: {
        antecedenciaMin: dados.antecedenciaMin ?? existente.antecedenciaMin,
        ativoLembrete: dados.ativoLembrete ?? existente.ativoLembrete,
        ativoRetorno: dados.ativoRetorno ?? existente.ativoRetorno,
        ativoAniversario: dados.ativoAniversario ?? existente.ativoAniversario,
      },
    });
  }
  return prisma.configMensagem.create({
    data: {
      clinicaId,
      antecedenciaMin: dados.antecedenciaMin ?? 1440,
      ativoLembrete: dados.ativoLembrete ?? true,
      ativoRetorno: dados.ativoRetorno ?? true,
      ativoAniversario: dados.ativoAniversario ?? true,
    },
  });
}
