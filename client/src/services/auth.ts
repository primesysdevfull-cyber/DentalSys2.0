import { api } from "../api/client";

export type Cargo = "administrador" | "dentista" | "recepcionista";

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  cargo: Cargo;
  ativo: boolean;
}

export interface Sessao {
  id: string;
  email: string;
  cargo: Cargo;
  permissoes: string[];
}

export interface LoginResponse {
  token: string;
  usuario: Usuario;
  clinica?: { id: string; nome: string };
}

export async function login(email: string, senha: string): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>("/api/auth/login", { email, senha });
  localStorage.setItem("dentalsys_token", data.token);
  localStorage.setItem("dentalsys_usuario", JSON.stringify(data.usuario));
  return data;
}

export async function registrar(dados: {
  clinicaNome: string;
  cnpj: string;
  clinicaEmail: string;
  telefone?: string;
  usuarioNome: string;
  usuarioEmail: string;
  senha: string;
}) {
  const { data } = await api.post<LoginResponse>("/api/auth/registro", dados);
  localStorage.setItem("dentalsys_token", data.token);
  localStorage.setItem("dentalsys_usuario", JSON.stringify(data.usuario));
  return data;
}

export function logout() {
  localStorage.removeItem("dentalsys_token");
  localStorage.removeItem("dentalsys_usuario");
}

export function usuarioLogado(): Usuario | null {
  const raw = localStorage.getItem("dentalsys_usuario");
  return raw ? JSON.parse(raw) : null;
}

export async function obterSessao(): Promise<Sessao> {
  const { data } = await api.get<Sessao>("/api/usuarios/me");
  return data;
}
