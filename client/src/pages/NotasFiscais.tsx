import { FormEvent, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  cancelarNota,
  ConfigNfse,
  criarNota,
  emitirNota,
  enviarCertificadoNfse,
  IntegracaoFiscal,
  listarIntegracoes,
  listarNotas,
  NotaFiscal,
  NotaInput,
  obterConfigNfse,
  ProvedorNota,
  salvarConfigNfse,
  salvarIntegracao,
} from "../services/notasfiscais";
import { listarPacientes, Paciente } from "../services/pacientes";
import { usePermissao } from "../context/PermissaoContext";
import { formatarMoeda, mascaraMoeda, parseMoeda } from "../utils/mascaras";

const STATUS_LABEL: Record<string, string> = {
  rascunho: "Rascunho",
  loteEnviado: "Lote enviado",
  autorizada: "Autorizada",
  rejeitada: "Rejeitada",
  cancelada: "Cancelada",
};

const PROVIDER_LABEL: Record<string, string> = {
  proprio: "Emissor próprio",
  tiny: "Tiny",
  bling: "Bling",
};

const formVazio = {
  pacienteId: "",
  tipo: "nfs_e" as const,
  descricao: "",
  codigoServico: "",
  valor: "",
  aliquota: "5",
  deducao: "",
  issRetido: false,
  observacao: "",
  provedor: "proprio" as ProvedorNota,
};

export default function NotasFiscais() {
  const { temPermissao } = usePermissao();
  const podeCriar = temPermissao("financeiro.criar");
  const podeExcluir = temPermissao("financeiro.excluir");
  const [searchParams] = useSearchParams();

  const [notas, setNotas] = useState<NotaFiscal[]>([]);
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [filtroStatus, setFiltroStatus] = useState("");
  const [form, setForm] = useState(formVazio);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [mostrarIntegracoes, setMostrarIntegracoes] = useState(false);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [emitindoId, setEmitindoId] = useState<string | null>(null);

  const carregar = async () => {
    setCarregando(true);
    try {
      setNotas(await listarNotas(filtroStatus || undefined));
    } catch (e: any) {
      setErro(e.response?.data?.error || "Erro ao carregar notas fiscais");
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroStatus]);

  useEffect(() => {
    listarPacientes()
      .then(setPacientes)
      .catch(() => setPacientes([]));
  }, []);

  useEffect(() => {
    const pacienteId = searchParams.get("pacienteId");
    if (!pacienteId || !pacientes.length) return;
    setForm((f) => ({
      ...f,
      pacienteId,
      valor: searchParams.get("valor") ? mascaraMoeda(searchParams.get("valor")!.replace(".", ",")) : f.valor,
      descricao: searchParams.get("descricao") || f.descricao,
      provedor: (searchParams.get("provedor") as ProvedorNota) || f.provedor,
    }));
    setMostrarForm(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pacientes.length]);

  const atualizar = (campo: keyof typeof formVazio, valor: string | boolean) =>
    setForm((f) => ({ ...f, [campo]: valor }));

  async function cadastrar(e: FormEvent) {
    e.preventDefault();
    setErro("");
    const dados: NotaInput = {
      pacienteId: form.pacienteId,
      tipo: form.tipo,
      descricao: form.descricao,
      codigoServico: form.codigoServico || null,
      valor: parseMoeda(form.valor),
      aliquota: Number(form.aliquota) || 0,
      deducao: parseMoeda(form.deducao),
      issRetido: form.issRetido,
      observacao: form.observacao || null,
      provedor: form.provedor,
    };
    try {
      await criarNota(dados);
      setForm(formVazio);
      setMostrarForm(false);
      carregar();
    } catch (err: any) {
      setErro(err.response?.data?.error || "Erro ao criar nota fiscal");
    }
  }

  async function emitir(n: NotaFiscal) {
    if (!confirm(`Emitir a nota fiscal nº ${n.numero} via ${PROVIDER_LABEL[n.provedor]}?`)) return;
    setEmitindoId(n.id);
    setErro("");
    try {
      const atualizada = await emitirNota(n.id);
      alert(atualizada.result?.mensagem || "Nota emitida.");
      carregar();
    } catch (err: any) {
      setErro(err.response?.data?.error || "Erro ao emitir nota");
    } finally {
      setEmitindoId(null);
    }
  }

  async function cancelar(n: NotaFiscal) {
    if (!confirm(`Cancelar a nota fiscal nº ${n.numero}?`)) return;
    setErro("");
    try {
      await cancelarNota(n.id);
      carregar();
    } catch (err: any) {
      setErro(err.response?.data?.error || "Erro ao cancelar nota");
    }
  }

  return (
    <div>
      <div className="cabecalho-pagina">
        <h2>Notas Fiscais</h2>
        <div className="toolbar">
          <button className="btn btn-secondary" onClick={() => setMostrarIntegracoes((v) => !v)}>
            Integrações
          </button>
          {podeCriar && (
            <button className="btn-novo" onClick={() => setMostrarForm((v) => !v)}>
              {mostrarForm ? "Fechar" : "+ Nova nota fiscal"}
            </button>
          )}
        </div>
      </div>

      {erro && <p className="text-danger mb-1">{erro}</p>}

      {mostrarIntegracoes && (
        <div className="card section-card">
          <h3 className="mb-1">Integrações fiscais</h3>
          <p className="text-muted mb-1">
            Conecte sua conta no <b>Tiny</b> (token da API) ou <b>Bling</b> (access token v3) para emitir as notas
            diretamente pelo sistema. Sem integração, a emissão usa o emissor próprio.
          </p>
          <IntegracoesForm onSalvo={() => carregar()} />
          <div className="divider">
            <ConfigNfseForm />
          </div>
        </div>
      )}

      {mostrarForm && (
        <form className="card" onSubmit={cadastrar}>
          <h3 className="mb-2">Nova nota fiscal</h3>
          <div className="grid-2">
            <div className="field">
              <label>Paciente *</label>
              <select required value={form.pacienteId} onChange={(e) => atualizar("pacienteId", e.target.value)}>
                <option value="">Selecione...</option>
                {pacientes.map((p) => (
                  <option key={p.id} value={p.id}>{p.nome}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Tipo</label>
              <select value={form.tipo} onChange={(e) => atualizar("tipo", e.target.value)}>
                <option value="nfs_e">NFS-e (serviço)</option>
                <option value="nf_e">NF-e (produto)</option>
              </select>
            </div>
            <div className="field">
              <label>Valor *</label>
              <input
                inputMode="decimal"
                placeholder="R$ 0,00"
                value={form.valor}
                onChange={(e) => atualizar("valor", mascaraMoeda(e.target.value))}
                required
              />
            </div>
            <div className="field">
              <label>Código de serviço (lista municipal)</label>
              <input
                placeholder="Ex.: 85.03 (odontologia)"
                value={form.codigoServico}
                onChange={(e) => atualizar("codigoServico", e.target.value)}
              />
            </div>
            <div className="field">
              <label>Descrição *</label>
              <input
                required
                placeholder="Ex.: Tratamento de canal - dente 26"
                value={form.descricao}
                onChange={(e) => atualizar("descricao", e.target.value)}
              />
            </div>
            <div className="field">
              <label>Alíquota ISS (%)</label>
              <input inputMode="decimal" value={form.aliquota} onChange={(e) => atualizar("aliquota", e.target.value)} />
            </div>
            <div className="field">
              <label>Deduções</label>
              <input
                inputMode="decimal"
                placeholder="R$ 0,00"
                value={form.deducao}
                onChange={(e) => atualizar("deducao", mascaraMoeda(e.target.value))}
              />
            </div>
            <div className="field">
              <label>Emissor</label>
              <select value={form.provedor} onChange={(e) => atualizar("provedor", e.target.value)}>
                <option value="proprio">Emissor próprio</option>
                <option value="tiny">Tiny</option>
                <option value="bling">Bling</option>
              </select>
            </div>
            <div className="field full-width">
              <label className="label-inline">
                <input
                  type="checkbox"
                  checked={form.issRetido}
                  onChange={(e) => atualizar("issRetido", e.target.checked)}
                />
                ISS retido
              </label>
            </div>
            <div className="field full-width">
              <label>Observações</label>
              <textarea rows={2} value={form.observacao} onChange={(e) => atualizar("observacao", e.target.value)} />
            </div>
          </div>
          <button className="btn btn-primary">Salvar nota</button>
        </form>
      )}

      <div className="toolbar" style={{ marginBottom: 12 }}>
        <label className="font-strong">Status:</label>
        <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)}>
          <option value="">Todos</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {carregando ? (
        <p>Carregando...</p>
      ) : notas.length === 0 ? (
        <div className="aviso-vazio">Nenhuma nota fiscal encontrada.</div>
      ) : (
        <table className="tabela-pacientes">
          <thead>
            <tr>
              <th>Nº</th>
              <th>Paciente</th>
              <th>Tipo</th>
              <th>Descrição</th>
              <th>Valor</th>
              <th>Emissor</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {notas.map((n) => (
              <tr key={n.id}>
                <td className="font-strong">{n.numero}</td>
                <td>{n.paciente?.nome || "—"}</td>
                <td>{n.tipo === "nfs_e" ? "NFS-e" : "NF-e"}</td>
                <td className="ellipsis">{n.descricao}</td>
                <td>{formatarMoeda(n.valor)}</td>
                <td>{PROVIDER_LABEL[n.provedor] || n.provedor}</td>
                <td>
                  <span className={n.status === "autorizada" ? "status-ativo" : "status-inativo"}>
                    {STATUS_LABEL[n.status] || n.status}
                  </span>
                  {n.protocolo && <div className="text-muted small">Prot.: {n.protocolo}</div>}
                </td>
                <td>
                  {n.status === "rascunho" && (
                    <button className="btn btn-primary btn-sm" onClick={() => emitir(n)} disabled={emitindoId === n.id}>
                      {emitindoId === n.id ? "Emitindo..." : "Emitir"}
                    </button>
                  )}
                  {n.status !== "cancelada" && podeExcluir && n.status !== "autorizada" && (
                    <button className="btn-excluir" onClick={() => cancelar(n)}>
                      Cancelar
                    </button>
                  )}
                  {n.mensagemRetorno && (
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => alert(n.mensagemRetorno)}
                    >
                      Detalhes
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function IntegracoesForm({ onSalvo }: { onSalvo: () => void }) {
  const [integracoes, setIntegracoes] = useState<IntegracaoFiscal[]>([]);
  const [form, setForm] = useState({ provedor: "tiny" as "tiny" | "bling", chave: "" });
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    listarIntegracoes().then(setIntegracoes).catch(() => setIntegracoes([]));
  }, []);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setErro("");
    setSalvando(true);
    try {
      await salvarIntegracao({ ...form, ativa: true });
      setForm({ ...form, chave: "" });
      setIntegracoes(await listarIntegracoes());
      onSalvo();
    } catch (err: any) {
      setErro(err.response?.data?.error || "Erro ao salvar integração");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div>
      <form onSubmit={salvar} className="form-inline">
        <div className="field">
          <label>ERP</label>
          <select value={form.provedor} onChange={(e) => setForm({ ...form, provedor: e.target.value as "tiny" | "bling" })}>
            <option value="tiny">Tiny</option>
            <option value="bling">Bling</option>
          </select>
        </div>
        <div className="field" style={{ flex: 1, minWidth: 260 }}>
          <label>{form.provedor === "tiny" ? "Token da API Tiny" : "Access token Bling v3"}</label>
          <input
            value={form.chave}
            onChange={(e) => setForm({ ...form, chave: e.target.value })}
            placeholder={form.provedor === "tiny" ? "Ex.: abc123..." : "Ex.: eyJhbGciOi..."}
            required
          />
        </div>
        <button className="btn btn-primary btn-sm" disabled={salvando}>{salvando ? "Salvando..." : "Salvar"}</button>
      </form>
      {erro && <p className="text-danger small mt-1">{erro}</p>}

      {integracoes.length > 0 && (
        <div style={{ marginTop: 12 }}>
          {integracoes.map((i) => (
            <div key={i.id} className="integracao-row">
              <span className="status-cargo">{i.provedor}</span>
              <span className="code-inline">{i.chave}</span>
              <span className={i.ativa ? "status-ativo" : "status-inativo"}>{i.ativa ? "Ativa" : "Inativa"}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ConfigNfseForm() {
  const [form, setForm] = useState<ConfigNfse>({ ambiente: "homologacao", padrao: "abrasf", ativa: false });
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    obterConfigNfse()
      .then((c) => c && setForm(c))
      .catch(() => undefined);
  }, []);

  const atualizar = (campo: keyof ConfigNfse, valor: string | boolean) =>
    setForm((f) => ({ ...f, [campo]: valor }));

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setErro("");
    setSalvando(true);
    try {
      const atualizado = await salvarConfigNfse(form);
      setForm(atualizado);
    } catch (err: any) {
      setErro(err.response?.data?.error || "Erro ao salvar configuração");
    } finally {
      setSalvando(false);
    }
  }

  async function enviarCertificado(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    setErro("");
    try {
      const atualizado = await enviarCertificadoNfse(arquivo);
      setForm((f) => ({ ...f, temCertificado: atualizado.temCertificado }));
    } catch (err: any) {
      setErro(err.response?.data?.error || "Erro ao enviar certificado");
    }
  }

  return (
    <div>
      <h3 style={{ marginBottom: 4 }}>Emissor próprio (NFS-e)</h3>
      <p style={{ fontSize: 13, color: "#475569", marginBottom: 12 }}>
        Para emitir pelo seu sistema é necessário o <b>certificado digital A1</b> e o <b>webservice</b> (ABRASF do
        município ou Ambiente Nacional NFS-e). Sem esta configuração, a emissão fica em simulação (lote enviado).
      </p>

      <form onSubmit={salvar} className="grid-2">
        <div className="field" style={{ margin: 0 }}>
          <label>Município</label>
          <input value={form.municipio || ""} onChange={(e) => atualizar("municipio", e.target.value)} />
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label>UF</label>
          <input maxLength={2} value={form.uf || ""} onChange={(e) => atualizar("uf", e.target.value.toUpperCase())} />
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label>Código IBGE</label>
          <input value={form.ibge || ""} onChange={(e) => atualizar("ibge", e.target.value)} />
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label>Inscrição Municipal</label>
          <input value={form.inscricaoMunicipal || ""} onChange={(e) => atualizar("inscricaoMunicipal", e.target.value)} />
        </div>
        <div className="field" style={{ margin: 0, gridColumn: "1 / -1" }}>
          <label>Endpoint homologação</label>
          <input placeholder="https://homologacao.prefeitura.gov.br/nfse" value={form.endpointHomologacao || ""} onChange={(e) => atualizar("endpointHomologacao", e.target.value)} />
        </div>
        <div className="field" style={{ margin: 0, gridColumn: "1 / -1" }}>
          <label>Endpoint produção</label>
          <input placeholder="https://producao.prefeitura.gov.br/nfse" value={form.endpointProducao || ""} onChange={(e) => atualizar("endpointProducao", e.target.value)} />
        </div>
        <div className="field" style={{ margin: 0, gridColumn: "1 / -1" }}>
          <label>Padrão / webservice</label>
          <select value={form.padrao || "abrasf"} onChange={(e) => atualizar("padrao", e.target.value)}>
            <option value="abrasf">ABRASF municipal (webservice da prefeitura)</option>
            <option value="nacional">Ambiente Nacional NFS-e (LC 214/2025)</option>
          </select>
          <p style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
            {form.padrao === "nacional"
              ? "Usa o webservice nacional da NFS-e (EnviarLoteRpsSincronoEnvio). Endpoints de homologação/produção do Ambiente Nacional."
              : "Usa o webservice ABRASF do seu município. Endpoints fornecidos pela prefeitura."}
          </p>
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label>Ambiente de emissão</label>
          <select value={form.ambiente || "homologacao"} onChange={(e) => atualizar("ambiente", e.target.value)}>
            <option value="homologacao">Homologação</option>
            <option value="producao">Produção</option>
          </select>
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label>Senha do certificado</label>
          <input type="password" value={form.certPassword || ""} onChange={(e) => atualizar("certPassword", e.target.value)} />
        </div>
        <div className="field" style={{ margin: 0, gridColumn: "1 / -1" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
            <input type="checkbox" checked={form.ativa || false} onChange={(e) => atualizar("ativa", e.target.checked)} />
            Habilitar emissão real pelo emissor próprio
          </label>
        </div>
        <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8, alignItems: "center" }}>
          <button className="btn btn-primary btn-sm" disabled={salvando}>
            {salvando ? "Salvando..." : "Salvar configuração"}
          </button>
          <span style={{ fontSize: 13, color: "#64748b" }}>
            Certificado: {form.temCertificado ? <b style={{ color: "var(--cor-sucesso)" }}>enviado ✓</b> : "não enviado"}
          </span>
        </div>
      </form>

      <div style={{ marginTop: 12 }}>
        <label className="btn btn-secondary btn-sm" style={{ cursor: "pointer" }}>
          {form.temCertificado ? "Substituir certificado (.pfx)" : "Enviar certificado (.pfx)"}
          <input type="file" accept=".pfx,.p12" style={{ display: "none" }} onChange={enviarCertificado} />
        </label>
      </div>

      {erro && <p style={{ color: "var(--cor-perigo)", fontSize: 13, marginTop: 8 }}>{erro}</p>}
    </div>
  );
}