import { api } from "../api/client";

export type TipoLancamento = "receita" | "despesa";
export type FormaPagamento = "dinheiro" | "pix" | "cartao_credito" | "cartao_debito" | "convenio" | "transferencia";
export type StatusLancamento = "pendente" | "pago" | "cancelado";

export interface Lancamento {
  id: string;
  tipo: TipoLancamento;
  descricao: string;
  valor: number;
  formaPagamento: FormaPagamento | null;
  status: StatusLancamento;
  desconto: number;
  quantidadeParcelas: number;
  numeroParcela: number;
  grupoParcelas: string | null;
  dataVencimento: string | null;
  dataPagamento: string | null;
  observacoes: string | null;
  criadoEm: string;
  paciente: { id: string; nome: string } | null;
  profissional: { id: string; nome: string } | null;
  procedimento: { id: string; nome: string } | null;
  comissao: number | null;
  comissaoPaga: boolean | null;
}

export interface LancamentoInput {
  tipo: TipoLancamento;
  descricao: string;
  valor: number;
  formaPagamento?: FormaPagamento | null;
  pacienteId?: string | null;
  profissionalId?: string | null;
  procedimentoId?: string | null;
  dataVencimento?: string | null;
  dataPagamento?: string | null;
  desconto?: number;
  quantidadeParcelas?: number;
  observacoes?: string | null;
}

export interface ResumoFinanceiro {
  totalRecebido: number;
  aReceber: number;
  totalDespesas: number;
  despesasPendentes: number;
  inadimplencia: number;
  saldo: number;
}

export interface SugestaoValor {
  procedimentoId: string;
  nome: string;
  codigoTuss: string | null;
  valorSugerido: number;
}

export interface Comissao {
  id: string;
  percentual: number;
  valor: number;
  paga: boolean;
  pagaEm: string | null;
  criadoEm: string;
  profissional: { id: string; nome: string };
  lancamento: {
    id: string;
    descricao: string;
    valor: number;
    status: StatusLancamento;
    dataPagamento: string | null;
    pacienteNome: string | null;
  };
}

export async function listarLancamentos(opts?: {
  inicio?: string;
  fim?: string;
  status?: StatusLancamento;
  tipo?: TipoLancamento;
  pacienteId?: string;
}): Promise<Lancamento[]> {
  const { data } = await api.get<Lancamento[]>("/api/financeiro/lancamentos", { params: opts });
  return data;
}

export async function criarLancamento(dados: LancamentoInput): Promise<Lancamento> {
  const { data } = await api.post<Lancamento>("/api/financeiro/lancamentos", dados);
  return data;
}

export async function atualizarLancamento(id: string, dados: Partial<LancamentoInput>): Promise<Lancamento> {
  const { data } = await api.put<Lancamento>(`/api/financeiro/lancamentos/${id}`, dados);
  return data;
}

export async function baixarLancamento(id: string): Promise<Lancamento> {
  const { data } = await api.post<Lancamento>(`/api/financeiro/lancamentos/${id}/baixar`);
  return data;
}

export async function cancelarLancamento(id: string): Promise<void> {
  await api.post(`/api/financeiro/lancamentos/${id}/cancelar`);
}

export async function excluirLancamento(id: string): Promise<void> {
  await api.delete(`/api/financeiro/lancamentos/${id}`);
}

export async function obterResumo(inicio?: string, fim?: string): Promise<ResumoFinanceiro> {
  const { data } = await api.get<ResumoFinanceiro>("/api/financeiro/resumo", { params: { inicio, fim } });
  return data;
}

export async function sugerirValorProcedimento(procedimentoId: string, pacienteId?: string): Promise<SugestaoValor> {
  const { data } = await api.get<SugestaoValor>("/api/financeiro/procedimentos/valor", {
    params: { procedimentoId, pacienteId },
  });
  return data;
}

export async function listarComissoes(profissionalId?: string): Promise<Comissao[]> {
  const { data } = await api.get<Comissao[]>("/api/financeiro/comissoes", {
    params: profissionalId ? { profissionalId } : {},
  });
  return data;
}

export async function marcarComissaoPaga(id: string): Promise<void> {
  await api.post(`/api/financeiro/comissoes/${id}/pagar`);
}
