import { api } from "../api/client";
import { Cargo } from "./auth";

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  cargo: Cargo;
  ativo: boolean;
  criadoEm?: string;
}

export interface UsuarioInput {
  nome: string;
  email: string;
  senha?: string;
  cargo: Cargo;
}

export async function listarUsuarios(): Promise<Usuario[]> {
  const { data } = await api.get<Usuario[]>("/api/usuarios");
  return data;
}

export async function criarUsuario(dados: UsuarioInput): Promise<Usuario> {
  const { data } = await api.post<Usuario>("/api/usuarios", dados);
  return data;
}

export async function atualizarUsuario(id: string, dados: Partial<UsuarioInput>): Promise<Usuario> {
  const { data } = await api.put<Usuario>(`/api/usuarios/${id}`, dados);
  return data;
}

export async function alternarAtivo(id: string): Promise<Usuario> {
  const { data } = await api.patch<Usuario>(`/api/usuarios/${id}/ativo`);
  return data;
}
