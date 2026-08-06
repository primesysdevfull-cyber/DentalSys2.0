import { api } from "../api/client";

export type FormaPagamento = "pix" | "boleto" | "cartao";

export interface ConfigPagamento {
  provider: string;
  ambiente: string;
  ativa: boolean;
  temCredenciais: boolean;
  pixChaveSet: boolean;
  temWebhookSecret: boolean;
  temWebhookIp: boolean;
  clientId?: string;
  clientSecret?: string;
  pixChave?: string;
  webhookSecret?: string;
  webhookIp?: string;
}

export interface Cobranca {
  id: string;
  forma: FormaPagamento;
  valor: number;
  status: string;
  gatewayId: string | null;
  pixCopiaECola: string | null;
  pixQrCodeUrl: string | null;
  boletoLinha: string | null;
  boletoUrl: string | null;
  cartaoLink: string | null;
  cartaoParcelas: number | null;
  cartaoUltimosDigitos: string | null;
  dataVencimento: string | null;
  dataPagamento: string | null;
  erro: string | null;
  criadoEm: string;
  lancamento: { id: string; descricao: string };
}

export async function obterConfigPagamento(): Promise<ConfigPagamento> {
  const { data } = await api.get<ConfigPagamento>("/api/pagamentos");
  return data;
}

export async function salvarConfigPagamento(
  dados: Partial<{
    provider: string;
    ambiente: string;
    clientId: string;
    clientSecret: string;
    pixChave: string;
    webhookSecret: string;
    webhookIp: string;
    ativa: boolean;
  }>
): Promise<ConfigPagamento> {
  const { data } = await api.put<ConfigPagamento>("/api/pagamentos/config", dados);
  return data;
}

export async function criarCobranca(
  lancamentoId: string,
  dados: {
    forma: FormaPagamento;
    vencimento?: string | null;
    cartao?: {
      nome: string;
      numero: string;
      mesValidade: string;
      anoValidade: string;
      cvv: string;
      parcelas: number;
    };
  }
): Promise<Cobranca> {
  const { data } = await api.post<Cobranca>(`/api/pagamentos/lancamentos/${lancamentoId}/cobranca`, dados);
  return data;
}

export async function marcarCobrancaPaga(cobrancaId: string): Promise<void> {
  await api.post(`/api/pagamentos/cobrancas/${cobrancaId}/marcar-pago`);
}
