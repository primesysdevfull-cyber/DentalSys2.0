import { api } from "../api/client";

export interface Sala {
  id: string;
  nome: string;
  ativa: boolean;
  criadoEm?: string;
}

export async function listarSalas(): Promise<Sala[]> {
  const { data } = await api.get<Sala[]>("/api/salas");
  return data;
}

export async function criarSala(dados: { nome: string }): Promise<Sala> {
  const { data } = await api.post<Sala>("/api/salas", dados);
  return data;
}

export async function atualizarSala(id: string, dados: Partial<{ nome: string; ativa: boolean }>): Promise<Sala> {
  const { data } = await api.put<Sala>(`/api/salas/${id}`, dados);
  return data;
}

export async function excluirSala(id: string): Promise<void> {
  await api.delete(`/api/salas/${id}`);
}
