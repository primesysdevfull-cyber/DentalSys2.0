import { Response } from "express";
import { z } from "zod";
import prisma from "../../config/database";
import { AuthRequest } from "../../middleware/auth";
import { obterProvedor } from "./providers";

const notaSchema = z.object({
  pacienteId: z.string().min(1, "Paciente é obrigatório"),
  lancamentoId: z.string().optional().nullable(),
  agendamentoId: z.string().optional().nullable(),
  tipo: z.enum(["nfs_e", "nf_e"]).default("nfs_e"),
  valor: z.number().positive("Valor deve ser maior que zero"),
  descricao: z.string().min(3, "Descrição muito curta").max(500),
  codigoServico: z.string().optional().nullable(),
  aliquota: z.number().min(0).max(100).default(5),
  deducao: z.number().min(0).default(0),
  issRetido: z.boolean().default(false),
  observacao: z.string().max(500).optional().nullable(),
  provedor: z.enum(["proprio", "tiny", "bling"]).default("proprio"),
});

export async function listarNotas(req: AuthRequest, res: Response) {
  const { clinicaId } = req.auth!;
  const { status } = req.query as Record<string, string | undefined>;

  const notas = await prisma.notaFiscal.findMany({
    where: { clinicaId, ...(status ? { status: status as any } : {}) },
    orderBy: { emitidaEm: "desc" },
    include: { paciente: { select: { id: true, nome: true, cpf: true } } },
  });

  res.json(notas.map((n) => ({ ...n, valor: Number(n.valor), aliquota: Number(n.aliquota), deducao: Number(n.deducao) })));
}

export async function criarNota(req: AuthRequest, res: Response) {
  const { clinicaId } = req.auth!;
  const dados = notaSchema.parse(req.body);

  const paciente = await prisma.paciente.findFirst({ where: { id: dados.pacienteId, clinicaId } });
  if (!paciente) return res.status(404).json({ error: "Paciente não encontrado" });

  if (dados.lancamentoId) {
    const lancamento = await prisma.lancamento.findFirst({ where: { id: dados.lancamentoId, clinicaId } });
    if (!lancamento) return res.status(404).json({ error: "Lançamento não encontrado" });
    if (lancamento.pacienteId !== paciente.id) {
      return res.status(400).json({ error: "O lançamento selecionado não pertence a este paciente" });
    }
  }
  if (dados.agendamentoId) {
    const agendamento = await prisma.agendamento.findFirst({ where: { id: dados.agendamentoId, clinicaId } });
    if (!agendamento) return res.status(404).json({ error: "Agendamento não encontrado" });
  }

  const ultimo = await prisma.notaFiscal.findFirst({
    where: { clinicaId },
    orderBy: { numero: "desc" },
    select: { numero: true },
  });
  const proximoNumero = (ultimo?.numero ?? 0) + 1;

  const nota = await prisma.notaFiscal.create({
    data: {
      clinicaId,
      numero: proximoNumero,
      tipo: dados.tipo,
      valor: dados.valor,
      descricao: dados.descricao,
      codigoServico: dados.codigoServico ?? null,
      aliquota: dados.aliquota,
      deducao: dados.deducao,
      issRetido: dados.issRetido,
      observacao: dados.observacao ?? null,
      pacienteId: dados.pacienteId,
      lancamentoId: dados.lancamentoId ?? null,
      agendamentoId: dados.agendamentoId ?? null,
      provedor: dados.provedor,
    },
    include: { paciente: { select: { id: true, nome: true, cpf: true } } },
  });

  res.status(201).json({ ...nota, valor: Number(nota.valor), aliquota: Number(nota.aliquota), deducao: Number(nota.deducao) });
}

export async function emitirNota(req: AuthRequest, res: Response) {
  const { clinicaId } = req.auth!;

  const nota = await prisma.notaFiscal.findFirst({
    where: { id: req.params.id, clinicaId },
    include: { clinica: true, paciente: true },
  });
  if (!nota) return res.status(404).json({ error: "Nota não encontrada" });
  if (nota.status === "cancelada") return res.status(400).json({ error: "Nota cancelada não pode ser emitida" });
  if (nota.status === "autorizada") return res.status(400).json({ error: "Nota já autorizada não pode ser reemitida" });
  if (nota.status === "loteEnviado") return res.status(400).json({ error: "Nota já enviada aguardando processamento" });

  let chave: string | null = null;
  if (nota.provedor !== "proprio") {
    const integracao = await prisma.integracaoFiscal.findFirst({
      where: { clinicaId, provedor: nota.provedor, ativa: true },
    });
    chave = integracao?.chave ?? null;
  }

  const provedor = obterProvedor(nota.provedor);
  const resultado = await provedor.emitir({ nota, clinica: nota.clinica, paciente: nota.paciente, chave });

  const atualizada = await prisma.notaFiscal.update({
    where: { id: nota.id },
    data: {
      status: resultado.status,
      protocolo: resultado.protocolo ?? null,
      nfsNumero: resultado.nfsNumero ?? null,
      xmlUrl: resultado.xmlUrl ?? null,
      danfeUrl: resultado.danfeUrl ?? null,
      externoId: resultado.externoId ?? null,
      mensagemRetorno: resultado.mensagem ?? null,
      autorizadaEm: resultado.status === "autorizada" ? new Date() : null,
    },
    include: { paciente: { select: { id: true, nome: true, cpf: true } } },
  });

  res.json({
    ...atualizada,
    valor: Number(atualizada.valor),
    aliquota: Number(atualizada.aliquota),
    deducao: Number(atualizada.deducao),
    result: resultado,
  });
}

export async function cancelarNota(req: AuthRequest, res: Response) {
  const { clinicaId } = req.auth!;
  const nota = await prisma.notaFiscal.findFirst({ where: { id: req.params.id, clinicaId } });
  if (!nota) return res.status(404).json({ error: "Nota não encontrada" });
  if (nota.status === "autorizada") {
    return res.status(400).json({ error: "Nota autorizada deve ser cancelada junto ao fisco/integrante." });
  }

  const atualizada = await prisma.notaFiscal.update({
    where: { id: nota.id },
    data: { status: "cancelada", canceladaEm: new Date() },
  });
  res.json(atualizada);
}

export async function obterIntegracoes(req: AuthRequest, res: Response) {
  const { clinicaId } = req.auth!;
  const integracoes = await prisma.integracaoFiscal.findMany({
    where: { clinicaId },
    select: { id: true, provedor: true, chave: true, ativa: true },
  });
  res.json(integracoes);
}

export async function salvarIntegracao(req: AuthRequest, res: Response) {
  const { clinicaId } = req.auth!;
  const dados = z
    .object({
      provedor: z.enum(["tiny", "bling"]),
      chave: z.string().min(1, "Chave é obrigatória"),
      ativa: z.boolean().default(true),
    })
    .parse(req.body);

  const integracao = await prisma.integracaoFiscal.upsert({
    where: { clinicaId_provedor: { clinicaId, provedor: dados.provedor } },
    create: { clinicaId, provedor: dados.provedor, chave: dados.chave, ativa: dados.ativa },
    update: { chave: dados.chave, ativa: dados.ativa },
  });

  res.json(integracao);
}

export async function obterConfigNfse(req: AuthRequest, res: Response) {
  const { clinicaId } = req.auth!;
  const config = await prisma.configNfse.findUnique({ where: { clinicaId } });
  res.json(
    config
      ? {
          ...config,
          temCertificado: Boolean(config.certPath),
          certPath: undefined,
          certPassword: undefined,
        }
      : null
  );
}

export async function salvarConfigNfse(req: AuthRequest, res: Response) {
  const { clinicaId } = req.auth!;
  const dados = z
    .object({
      municipio: z.string().optional().nullable(),
      uf: z.string().optional().nullable(),
      ibge: z.string().optional().nullable(),
      inscricaoMunicipal: z.string().optional().nullable(),
      endpointHomologacao: z.string().optional().nullable(),
      endpointProducao: z.string().optional().nullable(),
      certPassword: z.string().optional().nullable(),
      ambiente: z.enum(["homologacao", "producao"]).default("homologacao"),
      padrao: z.enum(["abrasf", "nacional"]).default("abrasf"),
      ativa: z.boolean().default(false),
    })
    .parse(req.body);

  const atual = await prisma.configNfse.findUnique({ where: { clinicaId } });
  const config = await prisma.configNfse.upsert({
    where: { clinicaId },
    create: {
      clinicaId,
      municipio: dados.municipio ?? null,
      uf: dados.uf ?? null,
      ibge: dados.ibge ?? null,
      inscricaoMunicipal: dados.inscricaoMunicipal ?? null,
      endpointHomologacao: dados.endpointHomologacao ?? null,
      endpointProducao: dados.endpointProducao ?? null,
      certPath: atual?.certPath ?? null,
      certPassword: dados.certPassword ?? atual?.certPassword ?? null,
      ambiente: dados.ambiente,
      padrao: dados.padrao,
      ativa: dados.ativa,
    },
    update: {
      municipio: dados.municipio ?? atual?.municipio ?? null,
      uf: dados.uf ?? atual?.uf ?? null,
      ibge: dados.ibge ?? atual?.ibge ?? null,
      inscricaoMunicipal: dados.inscricaoMunicipal ?? atual?.inscricaoMunicipal ?? null,
      endpointHomologacao: dados.endpointHomologacao ?? atual?.endpointHomologacao ?? null,
      endpointProducao: dados.endpointProducao ?? atual?.endpointProducao ?? null,
      certPassword: dados.certPassword ?? atual?.certPassword ?? null,
      ambiente: dados.ambiente,
      padrao: dados.padrao,
      ativa: dados.ativa,
    },
  });

  res.json({ ...config, temCertificado: Boolean(config.certPath), certPath: undefined, certPassword: undefined });
}

export async function uploadCertificadoNfse(req: AuthRequest, res: Response) {
  const { clinicaId } = req.auth!;
  const arquivo = (req as any).file as Express.Multer.File | undefined;
  if (!arquivo) {
    return res.status(400).json({ error: "Envie o arquivo do certificado (.pfx)" });
  }

  const config = await prisma.configNfse.upsert({
    where: { clinicaId },
    create: { clinicaId, certPath: arquivo.path },
    update: { certPath: arquivo.path },
  });

  res.json({ ...config, temCertificado: true, certPath: undefined, certPassword: undefined });
}