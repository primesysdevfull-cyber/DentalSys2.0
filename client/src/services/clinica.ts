import { api } from "../api/client";

export interface Clinica {
  id: string;
  nome: string;
  cnpj: string;
  email: string;
  telefone?: string | null;
  endereco?: string | null;
  razaoSocial?: string | null;
  responsavel?: string | null;
  logoUrl?: string | null;
  ativa: boolean;
  _count?: {
    usuarios: number;
    pacientes: number;
    profissionais: number;
    procedimentos: number;
    convenios: number;
  };
}

export async function obterClinica(): Promise<Clinica> {
  const { data } = await api.get<Clinica>("/api/clinica");
  return data;
}

export async function atualizarClinica(dados: Partial<Clinica>): Promise<Clinica> {
  const { data } = await api.put<Clinica>("/api/clinica", dados);
  return data;
}
