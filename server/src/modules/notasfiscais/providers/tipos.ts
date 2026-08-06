import type { Clinica, Paciente, NotaFiscal } from "@prisma/client";

export interface ResultadoEmissao {
  status: "autorizada" | "loteEnviado" | "rejeitada";
  protocolo?: string;
  nfsNumero?: string;
  mensagem?: string;
  xmlUrl?: string;
  danfeUrl?: string;
  externoId?: string;
}

export interface NotaFiscalParaEmissao {
  nota: NotaFiscal;
  clinica: Clinica;
  paciente: Paciente;
  chave?: string | null;
}

export interface NfProvider {
  nome: "proprio" | "tiny" | "bling";
  emitir(dados: NotaFiscalParaEmissao): Promise<ResultadoEmissao>;
}

export interface MetadadosNfse {
  inscricaoMunicipal?: string | null;
  ibge?: string | null;
  uf?: string | null;
}

export function dataLocal(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  return `${y}-${m}-${d}T${hh}:${mm}:${ss}`;
}

export function dataLocalSomenteDia(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Ambiente Nacional NFS-e (LC 214/2025) — layout ABRASF 2.04 com extensões nacionais.
// Serviço Síncrono "EnviarLoteRpsSincronoEnvio" (namespace do Ambiente Nacional).
export function gerarXmlNfseNacional(dados: NotaFiscalParaEmissao, numero: string, meta?: MetadadosNfse): string {
  const { nota, clinica, paciente } = dados;
  const prestadorCnpj = clinica.cnpj.replace(/\D/g, "");
  const tomadorCpf = (paciente.cpf || "").replace(/\D/g, "");
  const valor = Number(nota.valor);
  const deducao = Number(nota.deducao);
  const aliquota = Number(nota.aliquota);
  const base = valor - deducao;
  const iss = Math.round(base * aliquota) / 100;

  const endPaciente = (paciente.endereco || "").replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const bairroPaciente = (paciente.complemento || "").replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const cepPaciente = (paciente.cep || "").replace(/\D/g, "");
  const codigoMunicipioPrestador = (meta?.ibge || "").replace(/\D/g, "");
  const inscricaoMunicipal = meta?.inscricaoMunicipal || "";
  const ufPaciente = meta?.uf || "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<EnviarLoteRpsSincronoEnvio xmlns="https://www.nfse.gov.br/NFSE" xmlns:tns="https://www.nfse.gov.br/NFSE">
  <LoteRps xmlns="" versao="2.04" Id="L${numero}">
    <NumeroLote>${numero}</NumeroLote>
    <CpfCnpj><Cnpj>${prestadorCnpj}</Cnpj></CpfCnpj>
    <InscricaoMunicipal>${inscricaoMunicipal}</InscricaoMunicipal>
    <QuantidadeRps>1</QuantidadeRps>
    <ListaRps>
      <Rps>
        <IdentificacaoRps>
          <Numero>${numero}</Numero>
          <Serie>${nota.serie}</Serie>
          <Tipo>1</Tipo>
        </IdentificacaoRps>
        <DataEmissao>${dataLocal(nota.emitidaEm)}</DataEmissao>
        <NaturezaOperacao>1</NaturezaOperacao>
        <Competencia>${dataLocalSomenteDia(nota.emitidaEm)}</Competencia>
        <RegimeEspecialTributacao>6</RegimeEspecialTributacao>
        <OptanteSimplesNacional>1</OptanteSimplesNacional>
        <IncentivoFiscal>2</IncentivoFiscal>
        <Servico>
          <CodigoServicoNacional>${nota.codigoServico || "010101"}</CodigoServicoNacional>
          <Descricao><![CDATA[${(nota.descricao || "").replace(/\]\]>/g, "]]&gt;")}]]></Descricao>
          <TributacaoNacional>
            <Operacao>${nota.issRetido ? "0" : "1"}</Operacao>
            <FormaTributacao>1</FormaTributacao>
            <ModalidadeTributacao>1</ModalidadeTributacao>
            <Cbs>0.00</Cbs>
            <Ibs>0.00</Ibs>
          </TributacaoNacional>
          <IssRetido>${nota.issRetido ? "1" : "2"}</IssRetido>
          <ResponsavelRetencao>1</ResponsavelRetencao>
          <ItemListaServico>${nota.codigoServico || "0101"}</ItemListaServico>
          <Valores>
            <ValorServicos>${valor.toFixed(2)}</ValorServicos>
            <BaseCalculo>${base.toFixed(2)}</BaseCalculo>
            <Aliquota>${(aliquota / 100).toFixed(4)}</Aliquota>
            <ValorIss>${iss.toFixed(2)}</ValorIss>
            <ValorLiquidoNfse>${(valor - iss).toFixed(2)}</ValorLiquidoNfse>
          </Valores>
        </Servico>
        <Prestador>
          <CpfCnpj><Cnpj>${prestadorCnpj}</Cnpj></CpfCnpj>
          <InscricaoMunicipal>${inscricaoMunicipal}</InscricaoMunicipal>
          <CodigoMunicipio>${codigoMunicipioPrestador}</CodigoMunicipio>
        </Prestador>
        <Tomador>
          <IdentificacaoTomador>
            <CpfCnpj><Cpf>${tomadorCpf}</Cpf></CpfCnpj>
          </IdentificacaoTomador>
          <RazaoSocial><![CDATA[${(paciente.nome || "").replace(/\]\]>/g, "]]&gt;")}]]></RazaoSocial>
          <Endereco>
            <Endereco><![CDATA[${endPaciente}]]></Endereco>
            <Bairro><![CDATA[${bairroPaciente}]]></Bairro>
            <CodigoMunicipio>${codigoMunicipioPrestador}</CodigoMunicipio>
            <Uf>${ufPaciente}</Uf>
            <Cep>${cepPaciente}</Cep>
          </Endereco>
        </Tomador>
      </Rps>
    </ListaRps>
  </LoteRps>
</EnviarLoteRpsSincronoEnvio>`;
}

export function gerarXmlNfse(dados: NotaFiscalParaEmissao, numero: string): string {
  const { nota, clinica, paciente } = dados;
  const prestadorCnpj = clinica.cnpj.replace(/\D/g, "");
  const tomadorCpf = (paciente.cpf || "").replace(/\D/g, "");
  const valor = Number(nota.valor);
  const deducao = Number(nota.deducao);
  const aliquota = Number(nota.aliquota);
  const base = valor - deducao;
  const iss = Math.round(base * aliquota) / 100;

  const endereco = (clinica.endereco || "").replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const endPaciente = (paciente.endereco || "").replace(/&/g, "&amp;").replace(/</g, "&lt;");

  return `<?xml version="1.0" encoding="UTF-8"?>
<EnviarLoteRpsEnvio xmlns="http://www.abrasf.org.br/nfse">
  <Lote Id="L${numero}">
    <NumeroLote>${numero}</NumeroLote>
    <CpfCnpj><Cnpj>${prestadorCnpj}</Cnpj></CpfCnpj>
    <InscricaoMunicipal></InscricaoMunicipal>
    <QuantidadeRps>1</QuantidadeRps>
    <ListaRps>
      <Rps>
        <IdentificacaoRps>
          <Numero>${numero}</Numero>
          <Serie>${nota.serie}</Serie>
          <Tipo>1</Tipo>
        </IdentificacaoRps>
        <DataEmissao>${dataLocal(nota.emitidaEm)}</DataEmissao>
        <Status>1</Status>
        <Tributavel>true</Tributavel>
        <Servico>
          <CodigoTributacaoMunicipio>${nota.codigoServico || ""}</CodigoTributacaoMunicipio>
          <Discriminacao>${(nota.descricao || "").replace(/&/g, "&amp;").replace(/</g, "&lt;")}</Discriminacao>
          <IssRetido>${nota.issRetido ? "true" : "false"}</IssRetido>
          <ValorServicos>${valor.toFixed(2)}</ValorServicos>
          <ValorDeducoes>${deducao.toFixed(2)}</ValorDeducoes>
          <ValorIss>${iss.toFixed(2)}</ValorIss>
          <Aliquota>${(aliquota / 100).toFixed(4)}</Aliquota>
        </Servico>
        <Prestador>
          <CpfCnpj><Cnpj>${prestadorCnpj}</Cnpj></CpfCnpj>
          <InscricaoMunicipal></InscricaoMunicipal>
        </Prestador>
        <Tomador>
          <IdentificacaoTomador>
            <CpfCnpj><Cpf>${tomadorCpf}</Cpf></CpfCnpj>
          </IdentificacaoTomador>
          <RazaoSocial>${(paciente.nome || "").replace(/&/g, "&amp;").replace(/</g, "&lt;")}</RazaoSocial>
          <Endereco>
            <Endereco>${endPaciente}</Endereco>
            <Bairro></Bairro>
            <CodigoMunicipio></CodigoMunicipio>
            <Uf></Uf>
          </Endereco>
        </Tomador>
      </Rps>
    </ListaRps>
  </Lote>
</EnviarLoteRpsEnvio>`;
}
