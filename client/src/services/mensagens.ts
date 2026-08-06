import { api } from "../api/client";

export type TipoTemplate = "confirmacao" | "lembrete" | "retorno" | "aniversario";

export interface MensagemTemplate {
  id: string;
  tipo: TipoTemplate;
  nome: string;
  texto: string;
  ativo: boolean;
}

export const TIPOS_TEMPLATE: { tipo: TipoTemplate; label: string; exemplo: string }[] = [
  { tipo: "confirmacao", label: "Confirmação de agendamento", exemplo: "Olá {{paciente}}! Confirmamos seu atendimento em {{data}} às {{hora}} com {{profissional}}." },
  { tipo: "lembrete", label: "Lembrete", exemplo: "Lembrete: você tem atendimento com {{profissional}} em {{data}} às {{hora}}." },
  { tipo: "retorno", label: "Retorno", exemplo: "Olá {{paciente}}, está na hora do seu retorno com {{profissional}}." },
  { tipo: "aniversario", label: "Aniversário", exemplo: "Feliz aniversário, {{paciente}}! Equipe {{clinica}} deseja tudo de bom. 🎉" },
];

export const PLACEHOLDERS = [
  "{{paciente}}",
  "{{data}}",
  "{{hora}}",
  "{{profissional}}",
  "{{procedimento}}",
  "{{clinica}}",
];

export async function listarTemplates(): Promise<MensagemTemplate[]> {
  const { data } = await api.get<MensagemTemplate[]>("/api/mensagens/templates");
  return data;
}

export async function salvarTemplate(dados: Omit<MensagemTemplate, "id">): Promise<MensagemTemplate> {
  const { data } = await api.put<MensagemTemplate>("/api/mensagens/templates", dados);
  return data;
}

export async function excluirTemplate(id: string): Promise<void> {
  await api.delete(`/api/mensagens/templates/${id}`);
}

export interface ConfigMensagem {
  id: string;
  clinicaId: string;
  antecedenciaMin: number;
  ativoLembrete: boolean;
  ativoRetorno: boolean;
  ativoAniversario: boolean;
}

export interface EnvioMensagem {
  id: string;
  tipo: TipoTemplate;
  contato: string;
  texto: string;
  enviado: boolean;
  metodo: string;
  detalhe: string | null;
  criadoEm: string;
  paciente: { nome: string } | null;
}

export async function obterConfigMensagem(): Promise<ConfigMensagem> {
  const { data } = await api.get<ConfigMensagem>("/api/mensagens/config");
  return data;
}

export async function salvarConfigMensagem(
  dados: Partial<Pick<ConfigMensagem, "antecedenciaMin" | "ativoLembrete" | "ativoRetorno" | "ativoAniversario">>
): Promise<ConfigMensagem> {
  const { data } = await api.put<ConfigMensagem>("/api/mensagens/config", dados);
  return data;
}

export async function dispararMensagens(): Promise<{ lembretes: number; retornos: number; aniversarios: number; configurado: boolean }> {
  const { data } = await api.post("/api/mensagens/disparar");
  return data;
}

export async function listarEnvios(tipo?: string): Promise<EnvioMensagem[]> {
  const { data } = await api.get<EnvioMensagem[]>("/api/mensagens/envios", { params: tipo ? { tipo } : {} });
  return data;
}
