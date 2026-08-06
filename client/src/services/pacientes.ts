import { api } from "../api/client";

export interface Prontuario {
  id: string;
  titulo: string;
  conteudo: string;
  tipo: "evolucao" | "anamnese" | "exame";
  criadoEm: string;
}

export interface Paciente {
  id: string;
  nome: string;
  dataNascimento?: string | null;
  cpf?: string | null;
  rg?: string | null;
  telefone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  endereco?: string | null;
  complemento?: string | null;
  cep?: string | null;
  contatoEmergencial?: string | null;
  alergias?: string | null;
  indicacao?: string | null;
  observacoes?: string | null;
  convenioId?: string | null;
  convenio?: { id: string; nome: string; registro?: string | null } | null;
  status: string;
  criadoEm: string;
  prontuarios?: Prontuario[];
}

export interface PacienteInput {
  nome: string;
  dataNascimento?: string | null;
  cpf?: string | null;
  rg?: string | null;
  telefone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  endereco?: string | null;
  complemento?: string | null;
  cep?: string | null;
  contatoEmergencial?: string | null;
  alergias?: string | null;
  indicacao?: string | null;
  observacoes?: string | null;
  convenioId?: string | null;
}

export async function listarPacientes(busca?: string): Promise<Paciente[]> {
  const { data } = await api.get<Paciente[]>("/api/pacientes", {
    params: busca ? { busca } : {},
  });
  return data;
}

export async function obterPaciente(id: string): Promise<Paciente> {
  const { data } = await api.get<Paciente>(`/api/pacientes/${id}`);
  return data;
}

export async function criarPaciente(dados: PacienteInput): Promise<Paciente> {
  const { data } = await api.post<Paciente>("/api/pacientes", dados);
  return data;
}

export async function atualizarPaciente(id: string, dados: Partial<PacienteInput>): Promise<Paciente> {
  const { data } = await api.put<Paciente>(`/api/pacientes/${id}`, dados);
  return data;
}

export async function excluirPaciente(id: string): Promise<void> {
  await api.delete(`/api/pacientes/${id}`);
}

export async function adicionarProntuario(
  pacienteId: string,
  dados: { titulo: string; conteudo: string; tipo: Prontuario["tipo"] }
): Promise<Prontuario> {
  const { data } = await api.post<Prontuario>(`/api/pacientes/${pacienteId}/prontuarios`, dados);
  return data;
}

export async function excluirProntuario(pacienteId: string, prontuarioId: string): Promise<void> {
  await api.delete(`/api/pacientes/${pacienteId}/prontuarios/${prontuarioId}`);
}

export interface ResultadoImportacao {
  importados: number;
  erros: { linha: number; erro: string }[];
  pulados: { cpfDuplicado: number; semNome: number };
}

export async function exportarPacientes(): Promise<Blob> {
  const { data } = await api.get<Blob>("/api/pacientes/exportar", { responseType: "blob" });
  return data;
}

export async function importarPacientes(arquivo: File): Promise<ResultadoImportacao> {
  const formData = new FormData();
  formData.append("arquivo", arquivo);
  const { data } = await api.post<ResultadoImportacao>("/api/pacientes/importar", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}
