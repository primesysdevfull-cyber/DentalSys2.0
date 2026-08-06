import { NfProvider, ResultadoEmissao, NotaFiscalParaEmissao, dataLocal, dataLocalSomenteDia } from "./tipos";

const BLING_API = "https://www.bling.com.br/Api/v3";

export class ProvedorBling implements NfProvider {
  nome = "bling" as const;

  async emitir(dados: NotaFiscalParaEmissao): Promise<ResultadoEmissao> {
    const token = dados.chave;
    if (!token) {
      return { status: "rejeitada", mensagem: "Token de acesso da API Bling não configurado." };
    }

    const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

    const payload = dados.nota.tipo === "nfs_e" ? this.montarNfse(dados) : this.montarNfe(dados);

    const createRes = await fetch(`${BLING_API}/notas-de-servicos`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    const createJson = (await createRes.json()) as { data?: { id?: number }; error?: { type?: string; message?: string } };

    if (!createRes.ok || !createJson.data?.id) {
      return {
        status: "rejeitada",
        mensagem: createJson.error?.message || createJson.error?.type || `Erro Bling (${createRes.status})`,
      };
    }

    const idNota = createJson.data.id;
    const emitRes = await fetch(`${BLING_API}/notas-de-servicos/${idNota}/enviar`, {
      method: "POST",
      headers,
    });

    if (!emitRes.ok) {
      return {
        status: "autorizada",
        externoId: String(idNota),
        mensagem: "Nota criada no Bling, mas o envio à prefeitura retornou avisos. Verifique no Bling.",
      };
    }

    const emitJson = (await emitRes.json()) as { data?: { id?: number } };
    return {
      status: "autorizada",
      externoId: emitJson.data?.id ? String(emitJson.data.id) : String(idNota),
      nfsNumero: String(dados.nota.numero),
      protocolo: String(idNota),
      mensagem: "Nota criada e transmitida pela Bling.",
    };
  }

  private montarNfse({ nota, paciente }: NotaFiscalParaEmissao) {
    return {
      tipo: "S",
      numero: nota.numero,
      serie: nota.serie,
      dataEmissao: dataLocal(nota.emitidaEm),
      competencia: dataLocalSomenteDia(nota.emitidaEm),
      tomador: {
        nome: paciente.nome,
        cpf: (paciente.cpf || "").replace(/\D/g, "") || null,
        cnpj: null,
        endereco: paciente.endereco || null,
        email: paciente.email || null,
      },
      servicos: [
        {
          descricao: nota.descricao,
          quantidade: 1,
          valorUnitario: Number(nota.valor),
          valor: Number(nota.valor),
          codigoServicoMunicipal: nota.codigoServico || null,
          aliquotaIss: Number(nota.aliquota) / 100,
        },
      ],
      observacoes: nota.observacao || null,
      especiesDesconto: "M",
      desconto: Number(nota.deducao),
      retemIss: nota.issRetido,
    };
  }

  private montarNfe({ nota, clinica, paciente }: NotaFiscalParaEmissao) {
    return {
      numero: nota.numero,
      serie: nota.serie,
      tipoOperacao: "0",
      dataEmissao: dataLocal(nota.emitidaEm),
      cliente: {
        nome: paciente.nome,
        cpf: (paciente.cpf || "").replace(/\D/g, "") || null,
      },
      itens: [
        {
          numeroItem: 1,
          codigo: "",
          descricao: nota.descricao,
          quantidade: 1,
          valorUnitario: Number(nota.valor),
          tipo: "S",
        },
      ],
      total: { valorProdutos: Number(nota.valor), valorServicos: Number(nota.valor) },
      observacoes: nota.observacao || null,
      naturezaOperacao: "Venda de mercadoria",
      destinatarioEmitente: "D",
    };
  }
}