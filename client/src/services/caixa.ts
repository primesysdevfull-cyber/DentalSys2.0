import { api } from "../api/client";

export interface FechamentoCaixa {
  id: string;
  data: string;
  situacao: "aberto" | "fechado";
  dinheiroInicial: number;
  totalReceitas: number;
  totalDespesas: number;
  totalGeral: number;
  valorInformado: number | null;
  divergencia: number | null;
  observacoes: string | null;
  abertoEm: string | null;
  fechadoEm: string | null;
  responsavel: { id: string; nome: string; cargo: string } | null;
}

export interface MovimentacoesCaixa {
  totalReceitas: number;
  totalDespesas: number;
  totalGeral: number;
  porForma: Record<string, number>;
}

export interface CaixaDoDia {
  data: string;
  fechamento: FechamentoCaixa | null;
  totais: MovimentacoesCaixa;
}

export async function obterCaixa(data?: string): Promise<CaixaDoDia> {
  const { data: resp } = await api.get<CaixaDoDia>("/api/financeiro/caixa", { params: data ? { data } : {} });
  return resp;
}

export async function abrirCaixa(dados: { dinheiroInicial: number; observacoes?: string | null }): Promise<FechamentoCaixa> {
  const { data } = await api.post<FechamentoCaixa>("/api/financeiro/caixa/abrir", dados);
  return data;
}

export async function fecharCaixa(dados: { valorInformado: number; observacoes?: string | null }): Promise<FechamentoCaixa> {
  const { data } = await api.post<FechamentoCaixa>("/api/financeiro/caixa/fechar", dados);
  return data;
}

export async function listarHistoricoCaixa(): Promise<FechamentoCaixa[]> {
  const { data } = await api.get<FechamentoCaixa[]>("/api/financeiro/caixa/historico");
  return data;
}
