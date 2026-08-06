import { api } from "../api/client";

export type CondicaoDente =
  | "saudavel"
  | "carie"
  | "restauracao"
  | "extraido"
  | "canal"
  | "coroa"
  | "implante"
  | "ausente";

export interface Odontograma {
  pacienteId: string;
  dentes: Record<number, { condicao: CondicaoDente; observacao: string | null; atualizadoEm: string }>;
}

export interface DenteInput {
  numero: number;
  condicao: CondicaoDente;
  observacao?: string | null;
}

export interface Evolucao {
  id: string;
  descricao: string;
  conduta: string | null;
  criadoEm: string;
  profissional: { id: string; nome: string; especialidade: string | null };
}

export interface EvolucaoInput {
  profissionalId: string;
  descricao: string;
  conduta?: string | null;
  data?: string | null;
}

export interface Exame {
  id: string;
  tipo: "imagem" | "laudo";
  descricao: string | null;
  arquivoUrl: string | null;
  arquivoNome: string | null;
  criadoEm: string;
}

export interface ReceituarioMedicamento {
  nome: string;
  posologia: string;
  quantidade?: string | null;
}

export interface Receituario {
  id: string;
  medicamentos: ReceituarioMedicamento[];
  instrucoes: string | null;
  assinatura: string | null;
  criadoEm: string;
  profissional: { id: string; nome: string; cro: string | null };
}

export interface ReceituarioInput {
  profissionalId: string;
  medicamentos: ReceituarioMedicamento[];
  instrucoes?: string | null;
  assinatura?: string | null;
}

export async function obterOdontograma(pacienteId: string): Promise<Odontograma> {
  const { data } = await api.get<Odontograma>(`/api/prontuario/${pacienteId}/odontograma`);
  return data;
}

export async function atualizarDente(pacienteId: string, dente: DenteInput): Promise<unknown> {
  const { data } = await api.put(`/api/prontuario/${pacienteId}/odontograma`, dente);
  return data;
}

export async function resetarOdontograma(pacienteId: string): Promise<void> {
  await api.delete(`/api/prontuario/${pacienteId}/odontograma`);
}

export async function listarEvolucoes(pacienteId: string): Promise<Evolucao[]> {
  const { data } = await api.get<Evolucao[]>(`/api/prontuario/${pacienteId}/evolucoes`);
  return data;
}

export async function criarEvolucao(pacienteId: string, dados: EvolucaoInput): Promise<Evolucao> {
  const { data } = await api.post<Evolucao>(`/api/prontuario/${pacienteId}/evolucoes`, dados);
  return data;
}

export async function excluirEvolucao(pacienteId: string, evolucaoId: string): Promise<void> {
  await api.delete(`/api/prontuario/${pacienteId}/evolucoes/${evolucaoId}`);
}

export async function listarExames(pacienteId: string): Promise<Exame[]> {
  const { data } = await api.get<Exame[]>(`/api/prontuario/${pacienteId}/exames`);
  return data;
}

export async function criarExame(
  pacienteId: string,
  dados: { tipo: Exame["tipo"]; descricao?: string | null; arquivo: File }
): Promise<Exame> {
  const form = new FormData();
  form.append("tipo", dados.tipo);
  if (dados.descricao) form.append("descricao", dados.descricao);
  form.append("arquivo", dados.arquivo);
  const { data } = await api.post<Exame>(`/api/prontuario/${pacienteId}/exames`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function excluirExame(pacienteId: string, exameId: string): Promise<void> {
  await api.delete(`/api/prontuario/${pacienteId}/exames/${exameId}`);
}

export async function listarReceituarios(pacienteId: string): Promise<Receituario[]> {
  const { data } = await api.get<Receituario[]>(`/api/prontuario/${pacienteId}/receituarios`);
  return data;
}

export async function criarReceituario(pacienteId: string, dados: ReceituarioInput): Promise<Receituario> {
  const { data } = await api.post<Receituario>(`/api/prontuario/${pacienteId}/receituarios`, dados);
  return data;
}

export async function excluirReceituario(pacienteId: string, receituarioId: string): Promise<void> {
  await api.delete(`/api/prontuario/${pacienteId}/receituarios/${receituarioId}`);
}

export interface TermoConsentimento {
  id: string;
  titulo: string;
  conteudo: string;
  assinado: boolean;
  dataAssinatura: string | null;
  criadoEm: string;
  profissional: { id: string; nome: string; cro: string | null } | null;
}

export interface TermoConsentimentoInput {
  titulo: string;
  conteudo: string;
  profissionalId?: string | null;
  assinado?: boolean;
}

export async function listarTermos(pacienteId: string): Promise<TermoConsentimento[]> {
  const { data } = await api.get<TermoConsentimento[]>(`/api/prontuario/${pacienteId}/termos`);
  return data;
}

export async function criarTermo(pacienteId: string, dados: TermoConsentimentoInput): Promise<TermoConsentimento> {
  const { data } = await api.post<TermoConsentimento>(`/api/prontuario/${pacienteId}/termos`, dados);
  return data;
}

export async function assinarTermo(pacienteId: string, termoId: string): Promise<TermoConsentimento> {
  const { data } = await api.patch<TermoConsentimento>(`/api/prontuario/${pacienteId}/termos/${termoId}/assinar`);
  return data;
}

export async function excluirTermo(pacienteId: string, termoId: string): Promise<void> {
  await api.delete(`/api/prontuario/${pacienteId}/termos/${termoId}`);
}
