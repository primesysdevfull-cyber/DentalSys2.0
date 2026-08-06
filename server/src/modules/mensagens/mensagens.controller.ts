import { Response } from "express";
import { z } from "zod";
import prisma from "../../config/database";
import { AuthRequest } from "../../middleware/auth";

export const TIPOS_TEMPLATE = ["confirmacao", "lembrete", "retorno", "aniversario"] as const;
export type TipoTemplate = (typeof TIPOS_TEMPLATE)[number];

export const templateSchema = z.object({
  tipo: z.enum(TIPOS_TEMPLATE),
  nome: z.string().min(2, "Nome muito curto").max(100),
  texto: z.string().min(5, "Texto muito curto").max(2000),
  ativo: z.boolean().default(true),
});

export async function listarTemplates(req: AuthRequest, res: Response) {
  const { clinicaId } = req.auth!;
  const templates = await prisma.mensagemTemplate.findMany({
    where: { clinicaId },
    orderBy: { tipo: "asc" },
  });
  res.json(templates.map((t) => ({ ...t, ativo: t.ativo })));
}

export async function salvarTemplate(req: AuthRequest, res: Response) {
  const { clinicaId } = req.auth!;
  const dados = templateSchema.parse(req.body);

  const template = await prisma.mensagemTemplate.upsert({
    where: { clinicaId_tipo: { clinicaId, tipo: dados.tipo } },
    create: { clinicaId, ...dados },
    update: { nome: dados.nome, texto: dados.texto, ativo: dados.ativo },
  });

  res.json(template);
}

export async function excluirTemplate(req: AuthRequest, res: Response) {
  const { clinicaId } = req.auth!;
  const template = await prisma.mensagemTemplate.findFirst({
    where: { id: req.params.id, clinicaId },
    select: { id: true },
  });
  if (!template) {
    return res.status(404).json({ error: "Template não encontrado" });
  }
  await prisma.mensagemTemplate.delete({ where: { id: template.id } });
  res.status(204).send();
}

export function preencherTemplate(
  texto: string,
  vars: Record<string, string | number | undefined>
): string {
  return texto
    .replace(/\{\{paciente\}\}/g, vars.paciente?.toString() ?? "")
    .replace(/\{\{data\}\}/g, vars.data?.toString() ?? "")
    .replace(/\{\{hora\}\}/g, vars.hora?.toString() ?? "")
    .replace(/\{\{profissional\}\}/g, vars.profissional?.toString() ?? "")
    .replace(/\{\{procedimento\}\}/g, vars.procedimento?.toString() ?? "")
    .replace(/\{\{clinica\}\}/g, vars.clinica?.toString() ?? "");
}
