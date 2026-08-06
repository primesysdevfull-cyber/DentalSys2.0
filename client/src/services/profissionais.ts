import { api } from "../api/client";
import { Cargo } from "./auth";

export interface Profissional {
  id: string;
  nome: string;
  cro: string;
  especialidade?: string | null;
  horarioAtendimento?: string | null;
  comissao: number | string;
  usuario: { id: string; email: string; cargo: Cargo; ativo: boolean };
}

export interface ProfissionalInput {
  nome: string;
  cro: string;
  especialidade?: string | null;
  horarioAtendimento?: string | null;
  comissao?: number;
  email?: string;
  senha?: string;
  cargo?: Cargo;
}

export async function listarProfissionais(busca?: string): Promise<Profissional[]> {
  const { data } = await api.get<Profissional[]>("/api/profissionais", {
    params: busca ? { busca } : {},
  });
  return data;
}

export async function criarProfissional(dados: ProfissionalInput): Promise<Profissional> {
  const { data } = await api.post<Profissional>("/api/profissionais", dados);
  return data;
}

export async function atualizarProfissional(id: string, dados: Partial<ProfissionalInput>): Promise<Profissional> {
  const { data } = await api.put<Profissional>(`/api/profissionais/${id}`, dados);
  return data;
}

export async function excluirProfissional(id: string): Promise<void> {
  await api.delete(`/api/profissionais/${id}`);
}
