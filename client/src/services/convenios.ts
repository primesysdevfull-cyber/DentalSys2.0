import { api } from "../api/client";

export interface Convenio {
  id: string;
  nome: string;
  registro?: string | null;
  telefone?: string | null;
  ativo: boolean;
  _count?: { procedimentos: number };
}

export interface ConvenioInput {
  nome: string;
  registro?: string | null;
  telefone?: string | null;
  ativo?: boolean;
}

export async function listarConvenios(): Promise<Convenio[]> {
  const { data } = await api.get<Convenio[]>("/api/convenios");
  return data;
}

export async function criarConvenio(dados: ConvenioInput): Promise<Convenio> {
  const { data } = await api.post<Convenio>("/api/convenios", dados);
  return data;
}

export async function atualizarConvenio(id: string, dados: Partial<ConvenioInput>): Promise<Convenio> {
  const { data } = await api.put<Convenio>(`/api/convenios/${id}`, dados);
  return data;
}

export async function excluirConvenio(id: string): Promise<void> {
  await api.delete(`/api/convenios/${id}`);
}
