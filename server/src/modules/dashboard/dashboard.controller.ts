import { Response } from "express";
import prisma from "../../config/database";
import { AuthRequest } from "../../middleware/auth";

export async function resumoDashboard(req: AuthRequest, res: Response) {
  const { clinicaId, cargo } = req.auth!;
  const { inicio, fim } = req.query as Record<string, string | undefined>;

  const hoje = new Date();
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const fimHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 23, 59, 59);

  const dataInicio = inicio ? new Date(inicio) : inicioMes;
  const dataFim = fim ? new Date(fim) : fimHoje;

  const pacientesNovos = await prisma.paciente.count({
    where: { clinicaId, criadoEm: { gte: dataInicio, lte: dataFim } },
  });

  const totalPacientes = await prisma.paciente.count({ where: { clinicaId } });

  const agendamentosPeriodo = await prisma.agendamento.findMany({
    where: {
      clinicaId,
      dataHora: { gte: dataInicio, lte: dataFim },
      pacienteId: { not: null },
    },
    select: { status: true, procedimentoId: true },
  });

  const atendidos = agendamentosPeriodo.filter((a) => a.status === "atendido").length;
  const realizada =
    agendamentosPeriodo.filter((a) => a.status === "atendido" || a.status === "faltou").length;
  const taxaComparecimento =
    realizada > 0 ? Math.round((atendidos / realizada) * 1000) / 10 : 0;

  const agendadosProximos = await prisma.agendamento.count({
    where: {
      clinicaId,
      dataHora: { gte: hoje },
      pacienteId: { not: null },
      status: { in: ["agendado", "confirmado"] },
    },
  });

  const semConfirmacao = await prisma.agendamento.count({
    where: {
      clinicaId,
      dataHora: { gt: hoje },
      pacienteId: { not: null },
      status: "agendado",
      confirmacaoEnviada: false,
    },
  });

  const atendimentosPorProfissional = await prisma.agendamento.groupBy({
    by: ["profissionalId"],
    where: {
      clinicaId,
      dataHora: { gte: dataInicio, lte: dataFim },
      status: "atendido",
    },
    _count: { _all: true },
  });

  const profissionaisIds = atendimentosPorProfissional.map((g) => g.profissionalId);
  const profissionais = await prisma.profissional.findMany({
    where: { clinicaId, id: { in: profissionaisIds } },
    select: { id: true, nome: true },
  });

  const rankingProfissionais = atendimentosPorProfissional
    .map((g) => {
      const prof = profissionais.find((p) => p.id === g.profissionalId);
      return { nome: prof?.nome || "Profissional", atendimentos: g._count._all };
    })
    .sort((a, b) => b.atendimentos - a.atendimentos);

  let receitas = 0;
  let aReceber = 0;
  let despesas = 0;
  if (cargo === "administrador" || cargo === "recepcionista") {
    const lancamentos = await prisma.lancamento.findMany({
      where: {
        clinicaId,
        dataVencimento: { gte: dataInicio, lte: dataFim },
      },
      select: { tipo: true, valor: true, status: true },
    });
    receitas = Math.round(
      lancamentos
        .filter((l) => l.tipo === "receita" && l.status === "pago")
        .reduce((acc, l) => acc + Number(l.valor), 0) * 100
    ) / 100;
    aReceber = Math.round(
      lancamentos
        .filter((l) => l.tipo === "receita" && l.status === "pendente")
        .reduce((acc, l) => acc + Number(l.valor), 0) * 100
    ) / 100;
    despesas = Math.round(
      lancamentos
        .filter((l) => l.tipo === "despesa" && l.status !== "cancelado")
        .reduce((acc, l) => acc + Number(l.valor), 0) * 100
    ) / 100;
  }

  res.json({
    periodo: { inicio: dataInicio.toISOString(), fim: dataFim.toISOString() },
    totalPacientes,
    pacientesNovos,
    atendimentos: {
      realizados: atendidos,
      taxaComparecimento,
      agendadosProximos,
      semConfirmacao,
    },
    rankingProfissionais,
    financeiro: { receitas, aReceber, despesas },
    podeVerFinanceiro: cargo === "administrador" || cargo === "recepcionista",
  });
}

export async function avisosDashboard(req: AuthRequest, res: Response) {
  const { clinicaId, cargo } = req.auth!;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const fimSemana = new Date(hoje);
  fimSemana.setDate(fimSemana.getDate() + 7);

  const pacientes = await prisma.paciente.findMany({
    where: { clinicaId, dataNascimento: { not: null }, status: "ativo" },
    select: { id: true, nome: true, telefone: true, whatsapp: true, dataNascimento: true },
  });

  const mesHoje = hoje.getMonth();
  const diaHoje = hoje.getDate();
  const fimDia = fimSemana.getDate();
  const fimMes = fimSemana.getMonth();
  const cruzaMes = fimMes !== mesHoje;

  const aniversariantes = pacientes
    .filter((p) => {
      const d = p.dataNascimento!;
      if (cruzaMes) {
        return (
          (d.getMonth() === mesHoje && d.getDate() >= diaHoje) ||
          (d.getMonth() === fimMes && d.getDate() <= fimDia)
        );
      }
      return d.getMonth() === mesHoje && d.getDate() >= diaHoje && d.getDate() <= fimDia;
    })
    .map((p) => {
      const d = p.dataNascimento!;
      const proximo = new Date(hoje.getFullYear(), d.getMonth(), d.getDate());
      if (proximo < hoje) proximo.setFullYear(proximo.getFullYear() + 1);
      const diasAte = Math.round((proximo.getTime() - hoje.getTime()) / 86400000);
      return { id: p.id, nome: p.nome, telefone: p.whatsapp || p.telefone, diasAte };
    })
    .sort((a, b) => a.diasAte - b.diasAte);

  const retornosAtrasados = await prisma.agendamento.findMany({
    where: { clinicaId, ehRetorno: true, status: { in: ["agendado", "confirmado"] }, dataHora: { lt: hoje } },
    orderBy: { dataHora: "asc" },
    take: 5,
    include: { paciente: { select: { nome: true } }, profissional: { select: { nome: true } } },
  });

  const fimVencimento = new Date(hoje);
  fimVencimento.setDate(fimVencimento.getDate() + 7);
  fimVencimento.setHours(23, 59, 59);

  const vencimentos = await prisma.lancamento.findMany({
    where: {
      clinicaId,
      status: "pendente",
      dataVencimento: { not: null, lte: fimVencimento },
    },
    orderBy: { dataVencimento: "asc" },
    take: 8,
    include: { paciente: { select: { nome: true } }, profissional: { select: { nome: true } } },
  });

  res.json({
    aniversariantes,
    retornosAtrasados: retornosAtrasados.map((r) => ({
      id: r.id,
      dataHora: r.dataHora.toISOString(),
      paciente: r.paciente?.nome ?? null,
      profissional: r.profissional?.nome ?? null,
    })),
    vencimentos: vencimentos.map((l) => ({
      id: l.id,
      tipo: l.tipo,
      valor: Number(l.valor),
      dataVencimento: l.dataVencimento!.toISOString(),
      descricao: l.descricao,
      paciente: l.paciente?.nome ?? null,
      profissional: l.profissional?.nome ?? null,
      diasAte: Math.round(
        (new Date(l.dataVencimento!).setHours(0, 0, 0, 0) - hoje.getTime()) / 86400000
      ),
    })),
    podeVerFinanceiro: cargo === "administrador" || cargo === "recepcionista",
  });
}

export async function listarPendentesConfirmacao(req: AuthRequest, res: Response) {
  const { clinicaId } = req.auth!;
  const hoje = new Date();

  const pendentes = await prisma.agendamento.findMany({
    where: {
      clinicaId,
      dataHora: { gt: hoje },
      pacienteId: { not: null },
      status: "agendado",
      confirmacaoEnviada: false,
    },
    orderBy: { dataHora: "asc" },
    include: {
      paciente: { select: { id: true, nome: true, telefone: true, whatsapp: true } },
      profissional: { select: { id: true, nome: true } },
      procedimento: { select: { id: true, nome: true } },
    },
  });

  res.json(
    pendentes.map((a) => ({
      id: a.id,
      dataHora: a.dataHora.toISOString(),
      contato: a.paciente!.whatsapp || a.paciente!.telefone,
      possuiWhatsapp: Boolean(a.paciente!.whatsapp),
      paciente: a.paciente,
      profissional: a.profissional,
      procedimento: a.procedimento,
    }))
  );
}

export async function relatorioAgenda(req: AuthRequest, res: Response) {
  const { clinicaId } = req.auth!;
  const { inicio, fim } = req.query as Record<string, string | undefined>;

  const onde = {
    clinicaId,
    ...(inicio || fim
      ? {
          dataHora: {
            ...(inicio ? { gte: new Date(inicio) } : {}),
            ...(fim ? { lte: new Date(fim) } : {}),
          },
        }
      : {}),
  };

  const agendamentos = await prisma.agendamento.findMany({
    where: onde,
    orderBy: { dataHora: "asc" },
    include: {
      paciente: { select: { id: true, nome: true } },
      profissional: { select: { id: true, nome: true } },
      procedimento: { select: { id: true, nome: true } },
      sala: { select: { id: true, nome: true } },
    },
  });

  const contagem = await prisma.agendamento.groupBy({
    by: ["status"],
    _count: { _all: true },
    where: onde as any,
  });

  res.json({
    agendamentos: agendamentos.map((a) => ({
      id: a.id,
      dataHora: a.dataHora.toISOString(),
      status: a.status,
      paciente: a.paciente?.nome ?? null,
      profissional: a.profissional?.nome ?? null,
      procedimento: a.procedimento?.nome ?? null,
      sala: a.sala?.nome ?? null,
      observacoes: a.observacoes,
    })),
    porStatus: contagem,
  });
}

export async function relatorioCompleto(req: AuthRequest, res: Response) {
  const { clinicaId, cargo } = req.auth!;
  const { inicio, fim } = req.query as Record<string, string | undefined>;
  const de = inicio ? new Date(inicio) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const ate = fim ? new Date(fim) : new Date();
  const hoje = new Date();

  const onde = { clinicaId, dataHora: { gte: de, lte: ate } };

  // Procedimentos mais realizados (atendidos)
  const agendamentosPeriodo = await prisma.agendamento.findMany({
    where: onde,
    select: { status: true, procedimentoId: true, profissionalId: true },
  });

  const procedimentosCount = new Map<string, number>();
  for (const a of agendamentosPeriodo) {
    if (a.status !== "atendido" || !a.procedimentoId) continue;
    procedimentosCount.set(a.procedimentoId, (procedimentosCount.get(a.procedimentoId) || 0) + 1);
  }
  const procIds = Array.from(procedimentosCount.keys());
  const procs = await prisma.procedimento.findMany({
    where: { clinicaId, id: { in: procIds } },
    select: { id: true, nome: true },
  });
  const procedimentosMaisRealizados = Array.from(procedimentosCount.entries())
    .map(([id, qtd]) => ({ nome: procs.find((p) => p.id === id)?.nome || "Procedimento", quantidade: qtd }))
    .sort((a, b) => b.quantidade - a.quantidade)
    .slice(0, 10);

  // Taxa de faltas / confirmações
  const totalRealizados = agendamentosPeriodo.filter((a) => a.status === "atendido" || a.status === "faltou").length;
  const faltas = agendamentosPeriodo.filter((a) => a.status === "faltou").length;
  const taxaFaltas = totalRealizados > 0 ? Math.round((faltas / totalRealizados) * 1000) / 10 : 0;

  const agendamentosConfirmaveis = await prisma.agendamento.findMany({
    where: { ...onde, pacienteId: { not: null } },
    select: { status: true, confirmacaoEnviada: true },
  });
  const comConfirmacaoEnviada = agendamentosConfirmaveis.filter((a) => a.confirmacaoEnviada && a.status !== "cancelado" && a.status !== "faltou").length;
  const taxaConfirmacao = agendamentosConfirmaveis.length > 0
    ? Math.round((comConfirmacaoEnviada / agendamentosConfirmaveis.length) * 1000) / 10
    : 0;

  // Faturamento por profissional (receitas pagas vinculadas a um profissional)
  let faturamentoPorProfissional: { nome: string; valor: number }[] = [];
  let comissoesTotal = 0;
  let comissoesPendentes = 0;
  if (cargo === "administrador" || cargo === "recepcionista") {
    const lancamentos = await prisma.lancamento.findMany({
      where: { clinicaId, tipo: "receita", status: "pago", dataVencimento: { gte: de, lte: ate } },
      select: { valor: true, profissionalId: true },
    });
    const mapa = new Map<string, number>();
    for (const l of lancamentos) {
      if (!l.profissionalId) continue;
      mapa.set(l.profissionalId, (mapa.get(l.profissionalId) || 0) + Number(l.valor));
    }
    const profIds = Array.from(mapa.keys());
    const profs = await prisma.profissional.findMany({
      where: { clinicaId, id: { in: profIds } },
      select: { id: true, nome: true },
    });
    faturamentoPorProfissional = Array.from(mapa.entries())
      .map(([id, valor]) => ({ nome: profs.find((p) => p.id === id)?.nome || "Profissional", valor: Math.round(valor * 100) / 100 }))
      .sort((a, b) => b.valor - a.valor);

    const comissoes = await prisma.comissao.findMany({
      where: { clinicaId, lancamento: { dataVencimento: { gte: de, lte: ate } } },
      select: { valor: true, paga: true },
    });
    comissoesTotal = Math.round(comissoes.reduce((acc, c) => acc + Number(c.valor), 0) * 100) / 100;
    comissoesPendentes = Math.round(
      comissoes.filter((c) => !c.paga).reduce((acc, c) => acc + Number(c.valor), 0) * 100
    ) / 100;
  }

  // Retornos atrasados: retornos marcados ainda nao realizados com data anterior a hoje
  const retornos = await prisma.agendamento.findMany({
    where: { clinicaId, ehRetorno: true, status: { in: ["agendado", "confirmado"] }, dataHora: { lt: hoje } },
    include: { paciente: { select: { nome: true } }, profissional: { select: { nome: true } } },
  });

  res.json({
    periodo: { inicio: de.toISOString(), fim: ate.toISOString() },
    atendimento: { taxaFaltas, taxaConfirmacao, totalRealizados, faltas },
    procedimentosMaisRealizados,
    faturamentoPorProfissional,
    comissoes: { total: comissoesTotal, pendentes: comissoesPendentes },
    retornosAtrasados: retornos.map((r) => ({
      id: r.id,
      dataHora: r.dataHora.toISOString(),
      paciente: r.paciente?.nome ?? null,
      profissional: r.profissional?.nome ?? null,
    })),
    podeVerFinanceiro: cargo === "administrador" || cargo === "recepcionista",
  });
}

export async function resumoDoDia(req: AuthRequest, res: Response) {
  const { clinicaId, cargo } = req.auth!;
  const hoje = new Date();
  const inicioDia = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const fimDia = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 23, 59, 59, 999);

  const agendamentosHoje = await prisma.agendamento.findMany({
    where: { clinicaId, dataHora: { gte: inicioDia, lte: fimDia } },
    orderBy: { dataHora: "asc" },
    include: {
      paciente: { select: { id: true, nome: true } },
      profissional: { select: { nome: true } },
      procedimento: { select: { nome: true } },
    },
  });

  const atendidos = agendamentosHoje.filter((a) => a.status === "atendido").length;
  const realizada = agendamentosHoje.filter((a) => a.status === "atendido" || a.status === "faltou").length;
  const faltas = agendamentosHoje.filter((a) => a.status === "faltou").length;
  const taxaComparecimento = realizada > 0 ? Math.round((atendidos / realizada) * 1000) / 10 : 0;

  const proximo = agendamentosHoje.find(
    (a) => a.status === "agendado" || a.status === "confirmado"
  );

  let financeiro = null;
  if (cargo === "administrador" || cargo === "recepcionista") {
    const lancamentosDia = await prisma.lancamento.findMany({
      where: {
        clinicaId,
        OR: [
          { dataPagamento: { gte: inicioDia, lte: fimDia } },
          { dataVencimento: { gte: inicioDia, lte: fimDia }, status: "pendente" },
        ],
      },
      select: { tipo: true, valor: true, status: true },
    });

    const recebidoHoje = Math.round(
      lancamentosDia
        .filter((l) => l.tipo === "receita" && l.status === "pago")
        .reduce((acc, l) => acc + Number(l.valor), 0) * 100
    ) / 100;
    const aReceberHoje = Math.round(
      lancamentosDia
        .filter((l) => l.tipo === "receita" && l.status === "pendente")
        .reduce((acc, l) => acc + Number(l.valor), 0) * 100
    ) / 100;
    const despesasHoje = Math.round(
      lancamentosDia
        .filter((l) => l.tipo === "despesa" && l.status !== "cancelado")
        .reduce((acc, l) => acc + Number(l.valor), 0) * 100
    ) / 100;

    const fechamentoCaixa = await prisma.fechamentoCaixa.findUnique({
      where: { clinicaId_data: { clinicaId, data: inicioDia } },
      select: { situacao: true, totalGeral: true, divergencia: true, valorInformado: true, dinheiroInicial: true },
    });

    financeiro = { recebidoHoje, aReceberHoje, despesasHoje, fechamentoCaixa };
  }

  res.json({
    data: inicioDia.toISOString(),
    agendamentos: agendamentosHoje.map((a) => ({
      id: a.id,
      dataHora: a.dataHora.toISOString(),
      status: a.status,
      ehRetorno: a.ehRetorno,
      confirmacaoEnviada: a.confirmacaoEnviada,
      paciente: a.paciente,
      profissional: a.profissional?.nome ?? null,
      procedimento: a.procedimento?.nome ?? null,
    })),
    atendimento: { totalHoje: agendamentosHoje.length, atendidos, faltas, taxaComparecimento },
    proximo: proximo
      ? {
          id: proximo.id,
          dataHora: proximo.dataHora.toISOString(),
          paciente: proximo.paciente?.nome ?? null,
          profissional: proximo.profissional?.nome ?? null,
          procedimento: proximo.procedimento?.nome ?? null,
        }
      : null,
    financeiro,
    podeVerFinanceiro: cargo === "administrador" || cargo === "recepcionista",
  });
}