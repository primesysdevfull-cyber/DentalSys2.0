import { Response } from "express";
import { z } from "zod";
import prisma from "../../config/database";
import { AuthRequest } from "../../middleware/auth";
import { gerarCsv, parseCsv } from "../../config/csv";

const pacienteSchema = z.object({
  nome: z.string().min(2, "Nome é obrigatório"),
  dataNascimento: z.string().datetime().optional().nullable(),
  cpf: z
    .string()
    .regex(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/, "CPF deve estar no formato 000.000.000-00")
    .optional()
    .nullable(),
  rg: z.string().optional().nullable(),
  telefone: z.string().optional().nullable(),
  whatsapp: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  endereco: z.string().optional().nullable(),
  complemento: z.string().optional().nullable(),
  cep: z.string().regex(/^\d{5}-\d{3}$/, "CEP deve estar no formato 00000-000").optional().nullable(),
  contatoEmergencial: z.string().optional().nullable(),
  alergias: z.string().optional().nullable(),
  indicacao: z.string().optional().nullable(),
  observacoes: z.string().optional().nullable(),
  convenioId: z.string().optional().nullable(),
});

const prontuarioSchema = z.object({
  titulo: z.string().min(2),
  conteudo: z.string().min(1),
  tipo: z.enum(["evolucao", "anamnese", "exame"]).default("evolucao"),
});

function buscarEmClinica(id: string, clinicaId: string, comProntuario = true) {
  return prisma.paciente.findFirst({
    where: { id, clinicaId },
    include: {
      prontuarios: comProntuario ? { orderBy: { criadoEm: "desc" } } : false,
      convenio: { select: { id: true, nome: true, registro: true } },
    },
  });
}

export async function listarPacientes(req: AuthRequest, res: Response) {
  const { clinicaId, cargo } = req.auth!;
  const { busca } = req.query;

  const pacientes = await prisma.paciente.findMany({
    where: {
      clinicaId,
      ...(typeof busca === "string" && busca.length > 0
        ? {
            OR: [
              { nome: { contains: busca, mode: "insensitive" } },
              { cpf: { contains: busca } },
              { telefone: { contains: busca } },
              { whatsapp: { contains: busca } },
            ],
          }
        : {}),
    },
    orderBy: { nome: "asc" },
    include: {
      prontuarios: cargo === "recepcionista" ? false : { select: { id: true, titulo: true, criadoEm: true } },
      convenio: { select: { id: true, nome: true } },
    },
  });

  res.json(pacientes);
}

export async function obterPaciente(req: AuthRequest, res: Response) {
  const { clinicaId, cargo } = req.auth!;
  const comProntuario = cargo !== "recepcionista";
  const paciente = await buscarEmClinica(req.params.id, clinicaId, comProntuario);

  if (!paciente) {
    return res.status(404).json({ error: "Paciente não encontrado" });
  }
  res.json(paciente);
}

export async function criarPaciente(req: AuthRequest, res: Response) {
  const { clinicaId } = req.auth!;
  const dados = pacienteSchema.parse(req.body);

  const paciente = await prisma.paciente.create({
    data: { ...dados, clinicaId },
  });
  res.status(201).json(paciente);
}

export async function atualizarPaciente(req: AuthRequest, res: Response) {
  const { clinicaId } = req.auth!;
  const existente = await buscarEmClinica(req.params.id, clinicaId, false);

  if (!existente) {
    return res.status(404).json({ error: "Paciente não encontrado" });
  }

  const dados = pacienteSchema.partial().parse(req.body);
  const paciente = await prisma.paciente.update({
    where: { id: existente.id },
    data: dados,
  });
  res.json(paciente);
}

export async function excluirPaciente(req: AuthRequest, res: Response) {
  const { clinicaId } = req.auth!;
  const existente = await buscarEmClinica(req.params.id, clinicaId, false);

  if (!existente) {
    return res.status(404).json({ error: "Paciente não encontrado" });
  }

  await prisma.paciente.delete({ where: { id: existente.id } });
  res.status(204).send();
}

export async function adicionarProntuario(req: AuthRequest, res: Response) {
  const { clinicaId } = req.auth!;
  const paciente = await buscarEmClinica(req.params.id, clinicaId, false);

  if (!paciente) {
    return res.status(404).json({ error: "Paciente não encontrado" });
  }

  const dados = prontuarioSchema.parse(req.body);
  const prontuario = await prisma.prontuario.create({
    data: { ...dados, pacienteId: paciente.id, clinicaId },
  });
  res.status(201).json(prontuario);
}

export async function excluirProntuario(req: AuthRequest, res: Response) {
  const { clinicaId } = req.auth!;
  const prontuario = await prisma.prontuario.findFirst({
    where: { id: req.params.prontuarioId, clinicaId },
  });

  if (!prontuario) {
    return res.status(404).json({ error: "Prontuário não encontrado" });
  }

  await prisma.prontuario.delete({ where: { id: prontuario.id } });
  res.status(204).send();
}

function dataParaCsv(data?: Date | string | null): string {
  if (!data) return "";
  const d = new Date(data);
  if (isNaN(d.getTime())) return "";
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function converterData(valor: string): Date | null {
  const texto = valor.trim();
  if (!texto) return null;
  const iso = /^\d{4}-\d{2}-\d{2}/.test(texto) ? texto.slice(0, 10) : null;
  if (iso) return new Date(`${iso}T00:00:00Z`);
  const br = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texto);
  if (br) return new Date(`${br[3]}-${br[2]}-${br[1]}T00:00:00Z`);
  const d = new Date(texto);
  return isNaN(d.getTime()) ? null : d;
}

function normalizarCpf(valor: string | undefined): string | null {
  const v = (valor || "").trim();
  if (!v) return null;
  const digitos = v.replace(/\D/g, "");
  if (digitos.length !== 11) return null;
  return digitos.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

function normalizarCep(valor: string | undefined): string | null {
  const v = (valor || "").trim();
  if (!v) return null;
  const digitos = v.replace(/\D/g, "");
  if (digitos.length !== 8) return null;
  return digitos.replace(/(\d{5})(\d{3})/, "$1-$2");
}

export async function exportarPacientes(req: AuthRequest, res: Response) {
  const { clinicaId } = req.auth!;

  const pacientes = await prisma.paciente.findMany({
    where: { clinicaId },
    orderBy: { nome: "asc" },
    include: { convenio: { select: { nome: true } } },
  });

  const cabecalho = [
    "nome",
    "dataNascimento",
    "cpf",
    "rg",
    "telefone",
    "whatsapp",
    "email",
    "cep",
    "endereco",
    "complemento",
    "contatoEmergencial",
    "alergias",
    "indicacao",
    "observacoes",
    "convenio",
    "status",
  ];

  const linhas = pacientes.map((p) => [
    p.nome,
    dataParaCsv(p.dataNascimento),
    p.cpf,
    p.rg,
    p.telefone,
    p.whatsapp,
    p.email,
    p.cep,
    p.endereco,
    p.complemento,
    p.contatoEmergencial,
    p.alergias,
    p.indicacao,
    p.observacoes,
    p.convenio?.nome ?? "",
    p.status,
  ]);

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="pacientes.csv"');
  res.send(gerarCsv(cabecalho, linhas));
}

export async function importarPacientes(req: AuthRequest, res: Response) {
  const { clinicaId } = req.auth!;
  const arquivo = (req as any).file as Express.Multer.File | undefined;

  if (!arquivo) {
    return res.status(400).json({ error: "Envie um arquivo CSV" });
  }

  const conteudo = arquivo.buffer.toString("utf-8");
  const registros = parseCsv(conteudo);

  const convenios = await prisma.convenio.findMany({ where: { clinicaId }, select: { id: true, nome: true } });
  const cpfExistentes = new Set(
    (await prisma.paciente.findMany({ where: { clinicaId, cpf: { not: null } }, select: { cpf: true } })).map(
      (p) => p.cpf!
    )
  );

  let importados = 0;
  const erros: { linha: number; erro: string }[] = [];
  const pulados = { cpfDuplicado: 0, semNome: 0 };

  for (let i = 0; i < registros.length; i++) {
    const r = registros[i];
    const numeroLinha = i + 2;

    const nome = (r["nome"] || "").trim();
    if (!nome) {
      pulados.semNome++;
      continue;
    }

    const cpf = normalizarCpf(r["cpf"]);
    if (cpf && cpfExistentes.has(cpf)) {
      pulados.cpfDuplicado++;
      continue;
    }

    const convenioId = r["convenio"] ? convenios.find((c) => c.nome.toLowerCase() === r["convenio"].toLowerCase())?.id : undefined;
    const dataNascimento = converterData(r["datanascimento"]);

    try {
      await prisma.paciente.create({
        data: {
          clinicaId,
          nome,
          dataNascimento,
          cpf,
          rg: r["rg"] || null,
          telefone: r["telefone"] || null,
          whatsapp: r["whatsapp"] || null,
          email: r["email"] || null,
          cep: normalizarCep(r["cep"]),
          endereco: r["endereco"] || null,
          complemento: r["complemento"] || null,
          contatoEmergencial: r["contatoemergencial"] || null,
          alergias: r["alergias"] || null,
          indicacao: r["indicacao"] || null,
          observacoes: r["observacoes"] || null,
          convenioId,
          status: r["status"] === "inativo" ? "inativo" : "ativo",
        },
      });
      importados++;
      if (cpf) cpfExistentes.add(cpf);
    } catch (e: any) {
      erros.push({ linha: numeroLinha, erro: e.meta?.target ? "CPF/email duplicado" : "Erro ao salvar" });
    }
  }

  res.status(201).json({ importados, erros, pulados });
}
