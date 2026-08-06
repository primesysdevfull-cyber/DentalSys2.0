import { api } from "../api/client";

export type StatusNota = "rascunho" | "loteEnviado" | "autorizada" | "rejeitada" | "cancelada";
export type ProvedorNota = "proprio" | "tiny" | "bling";

export interface NotaFiscal {
  id: string;
  numero: number;
  serie: string;
  tipo: "nfs_e" | "nf_e";
  status: StatusNota;
  valor: number;
  descricao: string;
  codigoServico?: string | null;
  aliquota: number;
  deducao: number;
  issRetido: boolean;
  observacao?: string | null;
  pacienteId: string;
  paciente?: { id: string; nome: string; cpf?: string | null } | null;
  provedor: ProvedorNota;
  protocolo?: string | null;
  nfsNumero?: string | null;
  xmlUrl?: string | null;
  danfeUrl?: string | null;
  externoId?: string | null;
  mensagemRetorno?: string | null;
  emitidaEm: string;
  autorizadaEm?: string | null;
}

export interface IntegracaoFiscal {
  id: string;
  provedor: "tiny" | "bling";
  chave?: string | null;
  ativa: boolean;
}

export interface NotaInput {
  pacienteId: string;
  lancamentoId?: string | null;
  agendamentoId?: string | null;
  tipo: "nfs_e" | "nf_e";
  valor: number;
  descricao: string;
  codigoServico?: string | null;
  aliquota: number;
  deducao: number;
  issRetido: boolean;
  observacao?: string | null;
  provedor: ProvedorNota;
}

export async function listarNotas(status?: string): Promise<NotaFiscal[]> {
  const { data } = await api.get<NotaFiscal[]>("/api/notas-fiscais", { params: status ? { status } : {} });
  return data;
}

export async function criarNota(dados: NotaInput): Promise<NotaFiscal> {
  const { data } = await api.post<NotaFiscal>("/api/notas-fiscais", dados);
  return data;
}

export async function emitirNota(id: string): Promise<NotaFiscal & { result?: { status: string; mensagem?: string } }> {
  const { data } = await api.post(`/api/notas-fiscais/${id}/emitir`);
  return data;
}

export async function cancelarNota(id: string): Promise<NotaFiscal> {
  const { data } = await api.post(`/api/notas-fiscais/${id}/cancelar`);
  return data;
}

export async function listarIntegracoes(): Promise<IntegracaoFiscal[]> {
  const { data } = await api.get<IntegracaoFiscal[]>("/api/notas-fiscais/integracoes");
  return data;
}

export async function salvarIntegracao(dados: { provedor: "tiny" | "bling"; chave: string; ativa: boolean }): Promise<IntegracaoFiscal> {
  const { data } = await api.put<IntegracaoFiscal>("/api/notas-fiscais/integracoes", dados);
  return data;
}

export interface ConfigNfse {
  id?: string;
  municipio?: string | null;
  uf?: string | null;
  ibge?: string | null;
  inscricaoMunicipal?: string | null;
  endpointHomologacao?: string | null;
  endpointProducao?: string | null;
  certPassword?: string | null;
  ambiente?: "homologacao" | "producao";
  padrao?: "abrasf" | "nacional";
  ativa?: boolean;
  temCertificado?: boolean;
}

export async function obterConfigNfse(): Promise<ConfigNfse | null> {
  const { data } = await api.get<ConfigNfse | null>("/api/notas-fiscais/config/nfse");
  return data;
}

export async function salvarConfigNfse(dados: Partial<ConfigNfse>): Promise<ConfigNfse> {
  const { data } = await api.put<ConfigNfse>("/api/notas-fiscais/config/nfse", dados);
  return data;
}

export async function enviarCertificadoNfse(arquivo: File): Promise<ConfigNfse> {
  const formData = new FormData();
  formData.append("certificado", arquivo);
  const { data } = await api.post<ConfigNfse>("/api/notas-fiscais/config/nfse/certificado", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}
