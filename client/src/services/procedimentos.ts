import { api } from "../api/client";

export interface Procedimento {
  id: string;
  nome: string;
  codigoTuss?: string | null;
  valorParticular: number | string;
  duracaoMedia: number;
  ativo: boolean;
  convenios: { id: string; valor: number | string; convenio: { id: string; nome: string } }[];
}

export interface ProcedimentoInput {
  nome: string;
  codigoTuss?: string | null;
  valorParticular?: number;
  duracaoMedia?: number;
  ativo?: boolean;
}

export async function listarProcedimentos(busca?: string): Promise<Procedimento[]> {
  const { data } = await api.get<Procedimento[]>("/api/procedimentos", {
    params: busca ? { busca } : {},
  });
  return data;
}

export async function criarProcedimento(dados: ProcedimentoInput): Promise<Procedimento> {
  const { data } = await api.post<Procedimento>("/api/procedimentos", dados);
  return data;
}

export async function atualizarProcedimento(id: string, dados: Partial<ProcedimentoInput>): Promise<Procedimento> {
  const { data } = await api.put<Procedimento>(`/api/procedimentos/${id}`, dados);
  return data;
}

export async function excluirProcedimento(id: string): Promise<void> {
  await api.delete(`/api/procedimentos/${id}`);
}

export async function definirValorConvenio(
  procedimentoId: string,
  convenioId: string,
  valor: number
): Promise<void> {
  await api.put(`/api/procedimentos/${procedimentoId}/convenios/valor`, { convenioId, valor });
}
