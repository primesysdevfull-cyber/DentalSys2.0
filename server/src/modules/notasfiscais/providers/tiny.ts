import { NfProvider, ResultadoEmissao, NotaFiscalParaEmissao, dataLocalSomenteDia } from "./tipos";

const TINY_API = "https://api.tiny.com.br/api2";

export class ProvedorTiny implements NfProvider {
  nome = "tiny" as const;

  private endpoint = (tipo: string) =>
    tipo === "nfs_e" ? `${TINY_API}/nota.servico.incluir.php` : `${TINY_API}/nota.fiscal.incluir.php`;

  async emitir(dados: NotaFiscalParaEmissao): Promise<ResultadoEmissao> {
    const token = dados.chave;
    if (!token) {
      return { status: "rejeitada", mensagem: "Token da API Tiny não configurado." };
    }

    const notaInput = this.montarNota(dados);
    const body = new URLSearchParams({
      token,
      formato: "JSON",
      nota: JSON.stringify(notaInput),
    });

    const res = await fetch(this.endpoint(dados.nota.tipo), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    const json = (await res.json()) as { retorno?: { status?: string; status_processamento?: number; erros?: { erro?: string }[]; codigo?: string | number; id_nota?: string; numero?: string } };
    const r = json.retorno || {};

    if (r.status === "Erro") {
      return { status: "rejeitada", mensagem: r.erros?.[0]?.erro || `Erro Código ${r.codigo}`, externoId: r.id_nota ? String(r.id_nota) : undefined };
    }

    // Tiny é assíncrono: 1 = processada com sucesso, 2 = ainda em processamento, 3 = erro no processamento
    if (r.status_processamento === 3) {
      return {
        status: "rejeitada",
        mensagem: r.erros?.[0]?.erro || "Erro no processamento da nota na Tiny.",
        externoId: r.id_nota ? String(r.id_nota) : undefined,
      };
    }

    if (r.status_processamento === 2) {
      return {
        status: "loteEnviado",
        externoId: r.id_nota ? String(r.id_nota) : undefined,
        protocolo: r.id_nota ? String(r.id_nota) : undefined,
        mensagem: "Nota enviada à Tiny, aguardando processamento.",
      };
    }

    return {
      status: "autorizada",
      externoId: r.id_nota ? String(r.id_nota) : undefined,
      nfsNumero: r.numero ? String(r.numero) : String(dados.nota.numero),
      protocolo: r.id_nota ? String(r.id_nota) : undefined,
      mensagem: "Nota criada e transmitida pela Tiny.",
    };
  }

  private montarNota({ nota, clinica, paciente }: NotaFiscalParaEmissao) {
    const baseEmissao = {
      natureza_operacao: "Prestação de Serviço",
      data_emissao: dataLocalSomenteDia(nota.emitidaEm),
      previsao_chegada: dataLocalSomenteDia(nota.emitidaEm),
      desconto: 0,
      observacoes: nota.observacao || "",
      observacoes_internas: "",
      total_produtos: nota.tipo === "nf_e" ? nota.valor.toFixed(2) : "0.00",
      total_servicos: nota.tipo === "nfs_e" ? nota.valor.toFixed(2) : "0.00",
      cliente: {
        nome: paciente.nome,
        cpf_cnpj: (paciente.cpf || "").replace(/\D/g, ""),
        endereco: paciente.endereco || "",
        email: paciente.email || "",
      },
    };

    if (nota.tipo === "nfs_e") {
      return {
        nota_servico: {
          ...baseEmissao,
          servico: [
            {
              servico: {
                descricao: nota.descricao,
                quantidade: 1,
                valor_unitario: Number(nota.valor).toFixed(2),
                valor_servico: Number(nota.valor).toFixed(2),
                codigo_servico: nota.codigoServico || "",
                item_lista_servico: nota.codigoServico || "",
                codigo_tributacao_municipio: nota.codigoServico || "",
                aliquota_iss: Number(nota.aliquota).toFixed(2),
                iss_retido: nota.issRetido ? "S" : "N",
              },
            },
          ],
        },
      };
    }

    return {
      nota_fiscal: {
        ...baseEmissao,
        itens: [
          {
            item: {
              codigo: "",
              descricao: nota.descricao,
              unidade: "UN",
              quantidade: 1,
              valor_unitario: Number(nota.valor).toFixed(2),
              valor: Number(nota.valor).toFixed(2),
            },
          },
        ],
      },
    };
  }
}