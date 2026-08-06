import { NfProvider, ResultadoEmissao, NotaFiscalParaEmissao, gerarXmlNfse, gerarXmlNfseNacional } from "./tipos";
import prisma from "../../../config/database";

export class ProvedorProprio implements NfProvider {
  nome = "proprio" as const;

  async emitir(dados: NotaFiscalParaEmissao): Promise<ResultadoEmissao> {
    const numero = String(dados.nota.numero);

    const config = await prisma.configNfse.findUnique({ where: { clinicaId: dados.nota.clinicaId } });

    if (!config?.ativa || !config.certPath) {
      return {
        status: "loteEnviado",
        protocolo: `LOTE${numero}`,
        mensagem: "Emissor próprio não configurado. Cadastre o certificado A1 e o endpoint do município em Notas Fiscais → Configuração.",
      };
    }

    const padrao = config.padrao === "nacional" ? "nacional" : "abrasf";
    const xml =
      padrao === "nacional"
        ? gerarXmlNfseNacional(
            dados,
            numero,
            { inscricaoMunicipal: config.inscricaoMunicipal, ibge: config.ibge, uf: config.uf }
          )
        : gerarXmlNfse(dados, numero);

    const endpoint = config.ambiente === "producao" ? config.endpointProducao : config.endpointHomologacao;
    if (!endpoint) {
      return {
        status: "loteEnviado",
        protocolo: `LOTE${numero}`,
        mensagem: "Endpoint do webservice do município não configurado.",
      };
    }

    try {
      const { soapRequest } = await import("../../../utils/soap");
      const resposta = await soapRequest({
        url: endpoint,
        xml,
        certPath: config.certPath,
        certPassword: config.certPassword || "",
      });

      // Falha explícita de transmissão
      if (/<Fault>|Rejeicao|Rejeição|Falha/.test(resposta)) {
        return { status: "rejeitada", mensagem: extrairMensagem(resposta) || resposta.slice(0, 1000) };
      }

      // Recibo de lote (ABRASF assíncrono) sem autorização imediata
      if (/<Recibo>|<NumeroLote>/.test(resposta) && !/<Nfse>|<NfseNumero>|<NumeroNfse>/.test(resposta)) {
        return { status: "loteEnviado", protocolo: reciboLote(resposta) || `LOTE${numero}`, mensagem: "Lote recebido. Consulte o processamento do lote para confirmar a autorização." };
      }

      const numeroNacional = resposta.match(/<Nfse>(?:\s|.)*?<NumeroNfse>(\d+)<\/NumeroNfse>/)?.[1];
      const numeroMunicipal = resposta.match(/<NfseNumero>(\d+)<\/NfseNumero>/)?.[1];
      const nfsNumero = numeroNacional || numeroMunicipal || numero;

      return {
        status: "autorizada",
        protocolo: nfsNumero,
        nfsNumero,
        xmlUrl: `/uploads/nfse/nfse-${numero}.xml`,
        mensagem: "Nota transmitida e autorizada pelo fisco.",
      };
    } catch (e) {
      return {
        status: "rejeitada",
        mensagem: `Erro na transmissão: ${(e as Error).message}`,
      };
    }
  }
}

function extrairMensagem(xml: string): string | null {
  const msg = xml.match(/<(?:Descricao|Mensagem|FaultString|faultstring)>([^<]+)<\//i)?.[1];
  return msg ? msg.trim() : null;
}

function reciboLote(xml: string): string | null {
  const recibo = xml.match(/<(?:NumeroRecibo|NumeroLote)>([^<]+)<\//)?.[1];
  return recibo ? recibo.trim() : null;
}
