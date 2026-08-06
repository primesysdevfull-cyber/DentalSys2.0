import { api } from "../api/client";

export type StatusAgendamento =
  | "agendado"
  | "confirmado"
  | "atendido"
  | "faltou"
  | "cancelado"
  | "bloqueado";

export interface Agendamento {
  id: string;
  pacienteId?: string | null;
  profissionalId: string;
  salaId?: string | null;
  procedimentoId?: string | null;
  dataHora: string;
  duracaoMin: number;
  status: StatusAgendamento;
  observacoes?: string | null;
  ehRetorno: boolean;
  confirmacaoEnviada: boolean;
  agendamentoOrigemId?: string | null;
  paciente?: { id: string; nome: string; telefone?: string | null; whatsapp?: string | null } | null;
  profissional?: { id: string; nome: string; especialidade?: string | null };
  sala?: { id: string; nome: string } | null;
  procedimento?: { id: string; nome: string; duracaoMedia?: number } | null;
}

export interface AgendamentoInput {
  pacienteId?: string | null;
  profissionalId: string;
  salaId?: string | null;
  procedimentoId?: string | null;
  dataHora?: string | null;
  duracaoMin?: number;
  status?: StatusAgendamento;
  observacoes?: string | null;
  ehRetorno?: boolean;
}

export interface Atendimento {
  id: string;
  dataHora: string;
  status: "atendido" | "faltou";
  observacoes?: string | null;
  paciente?: { id: string; nome: string } | null;
  profissional?: { id: string; nome: string };
  procedimento?: { id: string; nome: string } | null;
  sala?: { id: string; nome: string } | null;
}

export async function listarAgenda(opts?: {
  inicio?: string;
  fim?: string;
  profissionalId?: string;
  salaId?: string;
}): Promise<Agendamento[]> {
  const { data } = await api.get<Agendamento[]>("/api/agenda", { params: opts });
  return data;
}

export async function obterAgendamento(id: string): Promise<Agendamento> {
  const { data } = await api.get<Agendamento>(`/api/agenda/${id}`);
  return data;
}

export async function criarAgendamento(dados: AgendamentoInput): Promise<Agendamento> {
  const { data } = await api.post<Agendamento>("/api/agenda", dados);
  return data;
}

export async function atualizarAgendamento(id: string, dados: Partial<AgendamentoInput>): Promise<Agendamento> {
  const { data } = await api.put<Agendamento>(`/api/agenda/${id}`, dados);
  return data;
}

export async function mudarStatusAgendamento(id: string, status: StatusAgendamento): Promise<Agendamento> {
  const { data } = await api.put<Agendamento>(`/api/agenda/${id}/status`, { status });
  return data;
}

export interface EnvioConfirmacao {
  enviado: boolean;
  metodo: "whatsapp" | "sms" | "simulado";
  atencao?: string;
}

export async function confirmarAgendamento(id: string): Promise<Agendamento & { mensagemEnviada?: string; contato?: string; envio?: EnvioConfirmacao }> {
  const { data } = await api.post(`/api/agenda/${id}/confirmar`);
  return data;
}

export async function bloquearHorario(dados: {
  profissionalId: string;
  salaId?: string | null;
  dataHora: string;
  duracaoMin?: number;
  observacoes?: string | null;
}): Promise<Agendamento> {
  const { data } = await api.post<Agendamento>("/api/agenda/bloquear", dados);
  return data;
}

export async function marcarRetorno(
  id: string,
  dados: { dataHora: string; duracaoMin?: number; salaId?: string | null; procedimentoId?: string | null; observacoes?: string | null }
): Promise<Agendamento> {
  const { data } = await api.post<Agendamento>(`/api/agenda/${id}/retorno`, dados);
  return data;
}

export async function historicoAtendimentos(pacienteId?: string): Promise<Atendimento[]> {
  const { data } = await api.get<Atendimento[]>("/api/agenda/historico", { params: { pacienteId } });
  return data;
}

export async function excluirAgendamento(id: string): Promise<void> {
  await api.delete(`/api/agenda/${id}`);
}
