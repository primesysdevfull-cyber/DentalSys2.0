import { Response } from "express";
import { z } from "zod";
import prisma from "../../config/database";
import { AuthRequest } from "../../middleware/auth";

export const lancamentoSchema = z.object({
  tipo: z.enum(["receita", "despesa"]),
  descricao: z.string().min(2, "Descrição muito curta").max(300),
  valor: z.number().positive("Valor deve ser maior que zero"),
  formaPagamento: z.enum(["dinheiro", "pix", "cartao_credito", "cartao_debito", "convenio", "transferencia"]).optional().nullable(),
  pacienteId: z.string().uuid().optional().nullable(),
  profissionalId: z.string().uuid().optional().nullable(),
  procedimentoId: z.string().uuid().optional().nullable(),
  dataVencimento: z.string().datetime().optional().nullable(),
  dataPagamento: z.string().datetime().optional().nullable(),
  desconto: z.number().min(0).default(0),
  quantidadeParcelas: z.number().int().min(1).max(36).default(1),
  observacoes: z.string().max(500).optional().nullable(),
});

async function pacienteDaClinica(pacienteId: string, clinicaId: string) {
  return prisma.paciente.findFirst({
    where: { id: pacienteId, clinicaId },
    select: { id: true },
  });
}

async function profissionalDaClinica(profissionalId: string, clinicaId: string) {
  return prisma.profissional.findFirst({
    where: { id: profissionalId, clinicaId },
    select: { id: true, comissao: true },
  });
}

async function procedimentoDaClinica(procedimentoId: string, clinicaId: string) {
  return prisma.procedimento.findFirst({
    where: { id: procedimentoId, clinicaId },
    select: { id: true },
  });
}

function serializarLancamento(l: {
  id: string;
  tipo: string;
  descricao: string;
  valor: unknown;
  formaPagamento: string | null;
  status: string;
  desconto: unknown;
  quantidadeParcelas: number;
  numeroParcela: number;
  grupoParcelas: string | null;
  dataVencimento: Date | null;
  dataPagamento: Date | null;
  observacoes: string | null;
  criadoEm: Date;
  paciente: { id: string; nome: string } | null;
  profissional: { id: string; nome: string } | null;
  procedimento: { id: string; nome: string } | null;
  comissoes: { id: string; valor: unknown; paga: boolean }[];
}) {
  return {
    id: l.id,
    tipo: l.tipo,
    descricao: l.descricao,
    valor: Number(l.valor),
    formaPagamento: l.formaPagamento,
    status: l.status,
    desconto: Number(l.desconto),
    quantidadeParcelas: l.quantidadeParcelas,
    numeroParcela: l.numeroParcela,
    grupoParcelas: l.grupoParcelas,
    dataVencimento: l.dataVencimento?.toISOString() ?? null,
    dataPagamento: l.dataPagamento?.toISOString() ?? null,
    observacoes: l.observacoes,
    criadoEm: l.criadoEm.toISOString(),
    paciente: l.paciente,
    profissional: l.profissional,
    procedimento: l.procedimento,
    comissao: l.comissoes.length ? Number(l.comissoes[0].valor) : null,
    comissaoPaga: l.comissoes.length ? l.comissoes[0].paga : null,
  };
}

const includeLancamento = {
  paciente: { select: { id: true, nome: true } },
  profissional: { select: { id: true, nome: true } },
  procedimento: { select: { id: true, nome: true } },
  comissoes: { select: { id: true, valor: true, paga: true } },
} as const;

export async function listarLancamentos(req: AuthRequest, res: Response) {
  const { clinicaId } = req.auth!;
  const { inicio, fim, status, tipo, pacienteId } = req.query as Record<string, string | undefined>;

  const lancamentos = await prisma.lancamento.findMany({
    where: {
      clinicaId,
      status: status as any,
      tipo: tipo as any,
      pacienteId,
      ...(inicio || fim
        ? {
            dataVencimento: {
              ...(inicio ? { gte: new Date(inicio) } : {}),
              ...(fim ? { lte: new Date(fim) } : {}),
            },
          }
        : {}),
    },
    orderBy: { criadoEm: "desc" },
    include: includeLancamento,
  });

  res.json(lancamentos.map(serializarLancamento));
}

export async function criarLancamento(req: AuthRequest, res: Response) {
  const { clinicaId } = req.auth!;
  const dados = lancamentoSchema.parse(req.body);

  if (dados.pacienteId) {
    const paciente = await pacienteDaClinica(dados.pacienteId, clinicaId);
    if (!paciente) return res.status(404).json({ error: "Paciente não encontrado" });
  }
  if (dados.profissionalId) {
    const profissional = await profissionalDaClinica(dados.profissionalId, clinicaId);
    if (!profissional) return res.status(404).json({ error: "Profissional não encontrado" });
  }
  if (dados.procedimentoId) {
    const procedimento = await procedimentoDaClinica(dados.procedimentoId, clinicaId);
    if (!procedimento) return res.status(404).json({ error: "Procedimento não encontrado" });
  }

  const valorLiquido = Math.round((Number(dados.valor) - Number(dados.desconto)) * 100) / 100;
  if (valorLiquido <= 0) {
    return res.status(400).json({ error: "O valor líquido (após desconto) deve ser maior que zero" });
  }

  const grupoParcelas = dados.quantidadeParcelas > 1 ? `P${Date.now()}` : null;
  const vencimentoBase = dados.dataVencimento ? new Date(dados.dataVencimento) : new Date();

  const criar = async (
    parcelaAtual: number,
    vencimento: Date,
    valorParcela: number,
    descricao: string
  ) => {
    const lancamento = await prisma.lancamento.create({
      data: {
        clinicaId,
        tipo: dados.tipo,
        descricao,
        valor: valorParcela,
        formaPagamento: dados.formaPagamento ?? null,
        pacienteId: dados.pacienteId ?? null,
        profissionalId: dados.profissionalId ?? null,
        procedimentoId: dados.procedimentoId ?? null,
        desconto: dados.desconto,
        quantidadeParcelas: dados.quantidadeParcelas,
        numeroParcela: parcelaAtual,
        grupoParcelas,
        dataVencimento: vencimento,
        dataPagamento: dados.dataPagamento ? new Date(dados.dataPagamento) : null,
        observacoes: dados.observacoes ?? null,
      },
      include: includeLancamento,
    });

    if (dados.tipo === "receita" && dados.profissionalId && valorParcela) {
      const profissional = await profissionalDaClinica(dados.profissionalId, clinicaId);
      const percentual = Number(profissional?.comissao || 0);
      if (percentual > 0) {
        const valorComissao = Math.round((valorParcela * percentual) / 100 * 100) / 100;
        await prisma.comissao.create({
          data: {
            clinicaId,
            lancamentoId: lancamento.id,
            profissionalId: dados.profissionalId,
            percentual,
            valor: valorComissao,
          },
        });
      }
    }

    return lancamento;
  };

  if (dados.quantidadeParcelas === 1) {
    const lancamento = await criar(1, vencimentoBase, valorLiquido, dados.descricao);
    const completo = await prisma.lancamento.findUnique({
      where: { id: lancamento.id },
      include: includeLancamento,
    });
    return res.status(201).json(completo ? serializarLancamento(completo) : completo);
  }

  const valorParcela = Math.round((valorLiquido / dados.quantidadeParcelas) * 100) / 100;
  const primeira = await criar(1, vencimentoBase, valorParcela, `${dados.descricao.trim()} (1/${dados.quantidadeParcelas})`);

  for (let i = 2; i <= dados.quantidadeParcelas; i++) {
    const venc = new Date(vencimentoBase.getFullYear(), vencimentoBase.getMonth() + (i - 1), vencimentoBase.getDate());
    await criar(i, venc, valorParcela, `${dados.descricao.trim()} (${i}/${dados.quantidadeParcelas})`);
  }

  const completo = await prisma.lancamento.findUnique({
    where: { id: primeira.id },
    include: includeLancamento,
  });
  res.status(201).json(completo ? serializarLancamento(completo) : completo);
}

export async function atualizarLancamento(req: AuthRequest, res: Response) {
  const { clinicaId } = req.auth!;
  const lancamento = await prisma.lancamento.findFirst({
    where: { id: req.params.id, clinicaId },
    select: { id: true },
  });

  if (!lancamento) {
    return res.status(404).json({ error: "Lançamento não encontrado" });
  }

  const dados = lancamentoSchema.partial().parse(req.body);
  const atualizado = await prisma.lancamento.update({
    where: { id: lancamento.id },
    data: {
      ...(dados.tipo !== undefined ? { tipo: dados.tipo } : {}),
      ...(dados.descricao !== undefined ? { descricao: dados.descricao } : {}),
      ...(dados.valor !== undefined ? { valor: dados.valor } : {}),
      ...(dados.formaPagamento !== undefined ? { formaPagamento: dados.formaPagamento } : {}),
      ...(dados.pacienteId !== undefined ? { pacienteId: dados.pacienteId } : {}),
      ...(dados.profissionalId !== undefined ? { profissionalId: dados.profissionalId } : {}),
      ...(dados.procedimentoId !== undefined ? { procedimentoId: dados.procedimentoId } : {}),
      ...(dados.dataVencimento !== undefined ? { dataVencimento: dados.dataVencimento ? new Date(dados.dataVencimento) : null } : {}),
      ...(dados.dataPagamento !== undefined ? { dataPagamento: dados.dataPagamento ? new Date(dados.dataPagamento) : null } : {}),
      ...(dados.desconto !== undefined ? { desconto: dados.desconto } : {}),
      ...(dados.observacoes !== undefined ? { observacoes: dados.observacoes } : {}),
    },
    include: includeLancamento,
  });

  res.json(serializarLancamento(atualizado));
}

export async function baixarLancamento(req: AuthRequest, res: Response) {
  const { clinicaId } = req.auth!;
  const lancamento = await prisma.lancamento.findFirst({
    where: { id: req.params.id, clinicaId },
    include: { comissoes: true },
  });

  if (!lancamento) {
    return res.status(404).json({ error: "Lançamento não encontrado" });
  }
  if (lancamento.status === "cancelado") {
    return res.status(400).json({ error: "Lançamento cancelado não pode ser baixado" });
  }

  const dataPagamento = new Date();
  const atualizado = await prisma.lancamento.update({
    where: { id: lancamento.id },
    data: { status: "pago", dataPagamento },
    include: includeLancamento,
  });

  res.json(serializarLancamento(atualizado));
}

export async function baixarLancamentoInterno(clinicaId: string, lancamentoId: string) {
  const lancamento = await prisma.lancamento.findFirst({
    where: { id: lancamentoId, clinicaId },
    select: { id: true, status: true },
  });

  if (!lancamento || lancamento.status === "cancelado") {
    return { baixado: false, motivo: "NaoEncontrado" as const };
  }

  await prisma.lancamento.update({
    where: { id: lancamento.id },
    data: { status: "pago", dataPagamento: new Date() },
  });

  return { baixado: true, motivo: "Pago" as const };
}

export async function cancelarLancamento(req: AuthRequest, res: Response) {
  const { clinicaId } = req.auth!;
  const lancamento = await prisma.lancamento.findFirst({
    where: { id: req.params.id, clinicaId },
    select: { id: true, status: true },
  });

  if (!lancamento) {
    return res.status(404).json({ error: "Lançamento não encontrado" });
  }
  if (lancamento.status === "pago") {
    return res.status(400).json({ error: "Lançamento pago não pode ser cancelado" });
  }

  await prisma.lancamento.update({
    where: { id: lancamento.id },
    data: { status: "cancelado" },
  });
  res.status(204).send();
}

export async function excluirLancamento(req: AuthRequest, res: Response) {
  const { clinicaId } = req.auth!;
  const lancamento = await prisma.lancamento.findFirst({
    where: { id: req.params.id, clinicaId },
    select: { id: true },
  });

  if (!lancamento) {
    return res.status(404).json({ error: "Lançamento não encontrado" });
  }

  await prisma.lancamento.delete({ where: { id: lancamento.id } });
  res.status(204).send();
}

export async function resumoFinanceiro(req: AuthRequest, res: Response) {
  const { clinicaId } = req.auth!;
  const { inicio, fim } = req.query as Record<string, string | undefined>;

  const filtro = {
    clinicaId,
    ...(inicio || fim
      ? {
          dataVencimento: {
            ...(inicio ? { gte: new Date(inicio) } : {}),
            ...(fim ? { lte: new Date(fim) } : {}),
          },
        }
      : {}),
  };

  const lancamentos = await prisma.lancamento.findMany({ where: filtro });

  const totalPago = lancamentos
    .filter((l) => l.status === "pago" && l.tipo === "receita")
    .reduce((acc, l) => acc + Number(l.valor), 0);
  const totalPendente = lancamentos
    .filter((l) => l.status === "pendente" && l.tipo === "receita")
    .reduce((acc, l) => acc + Number(l.valor), 0);
  const totalDespesas = lancamentos
    .filter((l) => l.tipo === "despesa" && l.status !== "cancelado")
    .reduce((acc, l) => acc + Number(l.valor), 0);
  const despesasPendentes = lancamentos
    .filter((l) => l.status === "pendente" && l.tipo === "despesa")
    .reduce((acc, l) => acc + Number(l.valor), 0);
  const inadimplencia = lancamentos
    .filter(
      (l) =>
        l.status === "pendente" &&
        l.tipo === "receita" &&
        l.dataVencimento &&
        l.dataVencimento < new Date()
    )
    .reduce((acc, l) => acc + Number(l.valor), 0);

  res.json({
    totalRecebido: Math.round(totalPago * 100) / 100,
    aReceber: Math.round(totalPendente * 100) / 100,
    totalDespesas: Math.round(totalDespesas * 100) / 100,
    despesasPendentes: Math.round(despesasPendentes * 100) / 100,
    inadimplencia: Math.round(inadimplencia * 100) / 100,
    saldo: Math.round((totalPago - totalDespesas) * 100) / 100,
  });
}

export async function listarComissoes(req: AuthRequest, res: Response) {
  const { clinicaId } = req.auth!;
  const { profissionalId } = req.query as Record<string, string | undefined>;

  const comissoes = await prisma.comissao.findMany({
    where: {
      clinicaId,
      profissionalId,
    },
    orderBy: { criadoEm: "desc" },
    include: {
      profissional: { select: { id: true, nome: true } },
      lancamento: {
        select: {
          id: true,
          descricao: true,
          valor: true,
          status: true,
          dataPagamento: true,
          paciente: { select: { nome: true } },
        },
      },
    },
  });

  res.json(
    comissoes.map((c) => ({
      id: c.id,
      percentual: Number(c.percentual),
      valor: Number(c.valor),
      paga: c.paga,
      pagaEm: c.pagaEm?.toISOString() ?? null,
      criadoEm: c.criadoEm.toISOString(),
      profissional: c.profissional,
      lancamento: {
        id: c.lancamento.id,
        descricao: c.lancamento.descricao,
        valor: Number(c.lancamento.valor),
        status: c.lancamento.status,
        dataPagamento: c.lancamento.dataPagamento?.toISOString() ?? null,
        pacienteNome: c.lancamento.paciente?.nome ?? null,
      },
    }))
  );
}

// Sugere o valor de um procedimento para um paciente (considera convênio) — usado no fluxo de lançamento a partir do prontuário.
export async function sugerirValorProcedimento(req: AuthRequest, res: Response) {
  const { clinicaId } = req.auth!;
  const { procedimentoId, pacienteId } = req.query as Record<string, string | undefined>;
  if (!procedimentoId) {
    return res.status(400).json({ error: "procedimentoId é obrigatório" });
  }

  const procedimento = await prisma.procedimento.findFirst({
    where: { id: procedimentoId, clinicaId },
    select: { id: true, nome: true, codigoTuss: true, valorParticular: true },
  });
  if (!procedimento) {
    return res.status(404).json({ error: "Procedimento não encontrado" });
  }

  let valor = Number(procedimento.valorParticular);

  if (pacienteId) {
    const paciente = await prisma.paciente.findFirst({
      where: { id: pacienteId, clinicaId },
      select: { convenioId: true },
    });
    if (paciente?.convenioId) {
      const convenioProc = await prisma.convenioProcedimento.findUnique({
        where: { convenioId_procedimentoId: { convenioId: paciente.convenioId, procedimentoId: procedimento.id } },
        select: { valor: true },
      });
      if (convenioProc && Number(convenioProc.valor) > 0) {
        valor = Number(convenioProc.valor);
      }
    }
  }

  res.json({
    procedimentoId: procedimento.id,
    nome: procedimento.nome,
    codigoTuss: procedimento.codigoTuss,
    valorSugerido: Math.round(valor * 100) / 100,
  });
}

export async function marcarComissaoPaga(req: AuthRequest, res: Response) {
  const { clinicaId } = req.auth!;
  const comissao = await prisma.comissao.findFirst({
    where: { id: req.params.id, clinicaId },
    select: { id: true },
  });

  if (!comissao) {
    return res.status(404).json({ error: "Comissão não encontrada" });
  }

  await prisma.comissao.update({
    where: { id: comissao.id },
    data: { paga: true, pagaEm: new Date() },
  });
  res.status(204).send();
}
