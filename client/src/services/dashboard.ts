import { api } from "../api/client";

export interface ResumoDashboard {
  periodo: { inicio: string; fim: string };
  totalPacientes: number;
  pacientesNovos: number;
  atendimentos: {
    realizados: number;
    taxaComparecimento: number;
    agendadosProximos: number;
    semConfirmacao: number;
  };
  rankingProfissionais: { nome: string; atendimentos: number }[];
  financeiro: { receitas: number; aReceber: number; despesas: number };
  podeVerFinanceiro: boolean;
}

export interface PendenteConfirmacao {
  id: string;
  dataHora: string;
  contato: string | null;
  possuiWhatsapp: boolean;
  paciente: { id: string; nome: string; telefone?: string | null; whatsapp?: string | null };
  profissional: { id: string; nome: string };
  procedimento: { id: string; nome: string } | null;
}

export interface RelatorioAgenda {
  agendamentos: {
    id: string;
    dataHora: string;
    status: string;
    paciente: string | null;
    profissional: string | null;
    procedimento: string | null;
    sala: string | null;
    observacoes: string | null;
  }[];
  porStatus: { _count: { _all: number }; status: string }[];
}

export interface RelatorioCompleto {
  periodo: { inicio: string; fim: string };
  atendimento: { taxaFaltas: number; taxaConfirmacao: number; totalRealizados: number; faltas: number };
  procedimentosMaisRealizados: { nome: string; quantidade: number }[];
  faturamentoPorProfissional: { nome: string; valor: number }[];
  comissoes: { total: number; pendentes: number };
  retornosAtrasados: { id: string; dataHora: string; paciente: string | null; profissional: string | null }[];
  podeVerFinanceiro: boolean;
}

export async function obterResumoDashboard(inicio?: string, fim?: string): Promise<ResumoDashboard> {
  const { data } = await api.get<ResumoDashboard>("/api/dashboard/resumo", {
    params: { inicio, fim },
  });
  return data;
}

export async function listarPendentesConfirmacao(): Promise<PendenteConfirmacao[]> {
  const { data } = await api.get<PendenteConfirmacao[]>("/api/dashboard/pendentes-confirmacao");
  return data;
}

export async function obterRelatorioAgenda(inicio?: string, fim?: string): Promise<RelatorioAgenda> {
  const { data } = await api.get<RelatorioAgenda>("/api/dashboard/relatorio-agenda", {
    params: { inicio, fim },
  });
  return data;
}

export async function obterRelatorioCompleto(inicio?: string, fim?: string): Promise<RelatorioCompleto> {
  const { data } = await api.get<RelatorioCompleto>("/api/dashboard/relatorio-completo", {
    params: { inicio, fim },
  });
  return data;
}

export interface AvisosDashboard {
  aniversariantes: { id: string; nome: string; telefone: string | null; diasAte: number }[];
  retornosAtrasados: { id: string; dataHora: string; paciente: string | null; profissional: string | null }[];
  vencimentos: {
    id: string;
    tipo: string;
    valor: number;
    dataVencimento: string;
    descricao: string;
    paciente: string | null;
    profissional: string | null;
    diasAte: number;
  }[];
  podeVerFinanceiro: boolean;
}

export async function obterAvisosDashboard(): Promise<AvisosDashboard> {
  const { data } = await api.get<AvisosDashboard>("/api/dashboard/avisos");
  return data;
}

export interface AgendamentoDia {
  id: string;
  dataHora: string;
  status: string;
  ehRetorno: boolean;
  confirmacaoEnviada: boolean;
  paciente: { id: string; nome: string } | null;
  profissional: string | null;
  procedimento: string | null;
}

export interface ResumoDia {
  data: string;
  agendamentos: AgendamentoDia[];
  atendimento: { totalHoje: number; atendidos: number; faltas: number; taxaComparecimento: number };
  proximo: { id: string; dataHora: string; paciente: string | null; profissional: string | null; procedimento: string | null } | null;
  financeiro: {
    recebidoHoje: number;
    aReceberHoje: number;
    despesasHoje: number;
    fechamentoCaixa: {
      situacao: string;
      totalGeral: number;
      divergencia: number | null;
      valorInformado: number | null;
      dinheiroInicial: number;
    } | null;
  } | null;
  podeVerFinanceiro: boolean;
}

export async function obterResumoDia(): Promise<ResumoDia> {
  const { data } = await api.get<ResumoDia>("/api/dashboard/dia");
  return data;
}