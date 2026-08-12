import { FormEvent, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  baixarLancamento,
  cancelarLancamento,
  criarLancamento,
  excluirLancamento,
  FormaPagamento,
  Lancamento,
  LancamentoInput,
  listarComissoes,
  listarLancamentos,
  marcarComissaoPaga,
  obterResumo,
  ResumoFinanceiro,
  StatusLancamento,
  TipoLancamento,
  Comissao,
  sugerirValorProcedimento,
} from "../services/financeiro";
import { listarPacientes, Paciente } from "../services/pacientes";
import { listarProfissionais, Profissional } from "../services/profissionais";
import { listarProcedimentos, Procedimento } from "../services/procedimentos";
import { usePermissao } from "../context/PermissaoContext";
import { formatarMoeda, mascaraMoeda, parseMoeda } from "../utils/mascaras";
import CobrancaModal from "../components/CobrancaModal";
import {
  abrirCaixa,
  CaixaDoDia,
  fecharCaixa,
  FechamentoCaixa,
  listarHistoricoCaixa,
  obterCaixa,
} from "../services/caixa";

type Aba = "lancamentos" | "comissoes" | "caixa";

const LABELS_FORMA: Record<FormaPagamento, string> = {
  dinheiro: "Dinheiro",
  pix: "Pix",
  cartao_credito: "Cartão de crédito",
  cartao_debito: "Cartão de débito",
  convenio: "Convênio",
  transferencia: "Transferência",
};

const LABELS_STATUS: Record<StatusLancamento, string> = {
  pendente: "Pendente",
  pago: "Pago",
  cancelado: "Cancelado",
};

const FORMAS: FormaPagamento[] = ["dinheiro", "pix", "cartao_credito", "cartao_debito", "convenio", "transferencia"];

function formatarData(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR");
}

const badgeStyle: React.CSSProperties = {
  padding: "4px 10px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 700,
  color: "#fff",
};

export default function Financeiro() {
  const [searchParams] = useSearchParams();
  const [aba, setAba] = useState<Aba>(() => {
    const a = searchParams.get("aba");
    return a === "comissoes" || a === "caixa" || a === "lancamentos" ? a : "lancamentos";
  });
  const { temPermissao } = usePermissao();
  const podeCriar = temPermissao("financeiro.criar");
  const podeBaixar = temPermissao("financeiro.baixar");
  const podeExcluir = temPermissao("financeiro.excluir");
  const podeComissoes = temPermissao("financeiro.comissoes");
  const podeCaixa = temPermissao("financeiro.caixa");
  const podeVer = temPermissao("financeiro.ver");

  if (!podeVer) {
    return <div className="aviso-vazio">Seu cargo não tem permissão para visualizar o financeiro.</div>;
  }

  return (
    <div>
      <div className="cabecalho-pagina">
        <h2>Financeiro</h2>
      </div>

      <div className="agenda-tabs" style={{ marginBottom: "1.25rem" }}>
        <button className={`agenda-tab ${aba === "lancamentos" ? "ativo" : ""}`} onClick={() => setAba("lancamentos")}>
          Lançamentos
        </button>
        <button className={`agenda-tab ${aba === "comissoes" ? "ativo" : ""}`} onClick={() => setAba("comissoes")}>
          Comissões
        </button>
        <button className={`agenda-tab ${aba === "caixa" ? "ativo" : ""}`} onClick={() => setAba("caixa")}>
          Fechamento de Caixa
        </button>
      </div>

      {aba === "lancamentos" && (
        <Lancamentos podeCriar={podeCriar} podeBaixar={podeBaixar} podeExcluir={podeExcluir} />
      )}
      {aba === "comissoes" && <Comissoes podeMarcar={podeComissoes} />}
      {aba === "caixa" && <Caixa podeOperar={podeCaixa} />}
    </div>
  );
}

function Caixa({ podeOperar }: { podeOperar: boolean }) {
  const [caixa, setCaixa] = useState<CaixaDoDia | null>(null);
  const [historico, setHistorico] = useState<FechamentoCaixa[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [dinheiroInicial, setDinheiroInicial] = useState("0,00");
  const [valorInformado, setValorInformado] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");

  const carregar = async () => {
    setCarregando(true);
    try {
      const [c, h] = await Promise.all([obterCaixa(), listarHistoricoCaixa()]);
      setCaixa(c);
      setHistorico(h);
      if (c.fechamento?.valorInformado !== null && c.fechamento?.valorInformado !== undefined) {
        setValorInformado(c.fechamento.valorInformado?.toFixed(2).replace(".", ",") ?? "");
      }
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregar();
  }, []);

  const fechamento = caixa?.fechamento ?? null;

  const abrir = async () => {
    setErro(""); setSucesso("");
    try {
      const valor = parseMoeda(dinheiroInicial);
      await abrirCaixa({ dinheiroInicial: valor, observacoes: observacoes || undefined });
      await carregar();
      setSucesso("Caixa aberto com sucesso.");
    } catch (e: any) {
      setErro(e.response?.data?.error || "Erro ao abrir o caixa");
    }
  };

  const fechar = async () => {
    setErro(""); setSucesso("");
    const valor = parseMoeda(valorInformado);
    if (valor < 0) {
      setErro("Informe o valor em caixa no fechamento.");
      return;
    }
    if (!confirm("Confirmar o fechamento do caixa de hoje?")) return;
    try {
      const novo = await fecharCaixa({ valorInformado: valor, observacoes: observacoes || undefined });
      await carregar();
      if (novo.divergencia !== null && novo.divergencia !== 0) {
        setSucesso(`Caixa fechado. Divergência de ${formatarMoeda(Math.abs(novo.divergencia))} ${novo.divergencia > 0 ? "positiva" : "negativa"}.`);
      } else {
        setSucesso("Caixa fechado. Sem divergências.");
      }
    } catch (e: any) {
      setErro(e.response?.data?.error || "Erro ao fechar o caixa");
    }
  };

  if (carregando) return <p>Carregando...</p>;

  const totais = caixa?.totais;

  return (
    <div>
      <div className="card" style={{ marginBottom: "1.25rem", borderLeft: "4px solid var(--cor-primaria)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
          <h3 style={{ marginBottom: 0 }}>Caixa de hoje — {new Date().toLocaleDateString("pt-BR")}</h3>
          <span className={`badge ${fechamento?.situacao === "fechado" ? "badge-sucesso" : "badge-aviso"}`} style={{ ...badgeStyle, background: fechamento?.situacao === "fechado" ? "#15803d" : fechamento?.situacao === "aberto" ? "#d97706" : "#64748b" }}>
            {fechamento?.situacao === "fechado" ? "Fechado" : fechamento?.situacao === "aberto" ? "Aberto" : "Não aberto"}
          </span>
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: "1rem" }}>
          <CartaoResumo titulo="Dinheiro inicial" valor={fechamento?.dinheiroInicial ?? 0} cor="#475569" />
          <CartaoResumo titulo="Receitas do dia" valor={fechamento?.totalReceitas ?? totais?.totalReceitas ?? 0} cor="var(--cor-sucesso)" />
          <CartaoResumo titulo="Despesas do dia" valor={fechamento?.totalDespesas ?? totais?.totalDespesas ?? 0} cor="var(--cor-perigo)" />
          <CartaoResumo titulo="Total em caixa (esperado)" valor={fechamento?.totalGeral ?? (totais?.totalGeral ?? 0)} cor="#1d4ed8" />
          {fechamento?.divergencia !== null && fechamento?.divergencia !== undefined && (
            <CartaoResumo
              titulo="Divergência"
              valor={fechamento.divergencia ?? 0}
              cor={(fechamento.divergencia ?? 0) === 0 ? "var(--cor-sucesso)" : "var(--cor-perigo)"}
            />
          )}
        </div>

        {totais && Object.keys(totais.porForma).length > 0 && (
          <p style={{ fontSize: 13, color: "#475569", marginBottom: "1rem" }}>
            <b>Por forma de pagamento:</b>{" "}
            {Object.entries(totais.porForma)
              .map(([f, v]) => `${LABELS_FORMA[f as FormaPagamento] || f}: ${formatarMoeda(v)}`)
              .join("  •  ")}
          </p>
        )}

        {!fechamento && (
          <div className="field">
            <label>Dinheiro inicial</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <input
                style={{ maxWidth: 160 }}
                value={dinheiroInicial}
                onChange={(e) => setDinheiroInicial(mascaraMoeda(e.target.value))}
              />
              <input
                style={{ maxWidth: 260 }}
                placeholder="Observações da abertura (opcional)"
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
              />
              {podeOperar ? (
                <button className="btn btn-primary" onClick={abrir}>Abrir caixa</button>
              ) : (
                <button className="btn btn-primary" disabled title="Somente administrador abre o caixa">Abrir caixa</button>
              )}
            </div>
          </div>
        )}

        {fechamento?.situacao === "aberto" && (
          <div className="field" style={{ marginTop: 8 }}>
            <label>Valor contado em caixa (informado)</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <input
                style={{ maxWidth: 160 }}
                placeholder="0,00"
                value={valorInformado}
                onChange={(e) => setValorInformado(mascaraMoeda(e.target.value))}
              />
              <button className="btn btn-primary" onClick={fechar} disabled={!podeOperar}>Fechar caixa</button>
            </div>
          </div>
        )}

        {erro && <p style={{ color: "var(--cor-perigo)", marginTop: 8 }}>{erro}</p>}
        {sucesso && <p style={{ color: "var(--cor-sucesso)", marginTop: 8 }}>{sucesso}</p>}
        {!podeOperar && <p style={{ fontSize: 13, color: "#d97706", marginTop: 8 }}>Somente o administrador pode abrir/fechar o caixa.</p>}
      </div>

      <div className="card">
        <h3 style={{ marginBottom: "0.75rem" }}>Histórico de fechamentos</h3>
        {historico.length === 0 ? (
          <div className="aviso-vazio">Nenhum fechamento registrado.</div>
        ) : (
          <div className="historico-cards">
            {historico.map((h) => (
              <div className="card" key={h.id}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
                  <b>{new Date(h.data).toLocaleDateString("pt-BR")}</b>
                  <span style={{ fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 999, color: "#fff", background: h.situacao === "fechado" ? "#15803d" : "#d97706" }}>
                    {h.situacao === "fechado" ? "Fechado" : "Aberto"}
                  </span>
                </div>
                <div style={{ fontSize: 13, color: "#475569", display: "grid", gap: 3 }}>
                  <span>Receitas: <b style={{ color: "var(--cor-sucesso)" }}>{formatarMoeda(h.totalReceitas)}</b> • Despesas: <b style={{ color: "var(--cor-perigo)" }}>{formatarMoeda(h.totalDespesas)}</b></span>
                  <span>Total em caixa: <b>{formatarMoeda(h.totalGeral)}</b>
                    {h.divergencia !== null && (
                      <> • Divergência: <b style={{ color: (h.divergencia ?? 0) === 0 ? "var(--cor-sucesso)" : "var(--cor-perigo)" }}>{formatarMoeda(h.divergencia ?? 0)}</b></>
                    )}
                  </span>
                  <span>Responsável: {h.responsavel?.nome || "—"}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CartaoResumo({ titulo, valor, cor }: { titulo: string; valor: number; cor: string }) {
  return (
    <div className="card" style={{ flex: 1, minWidth: 180 }}>
      <div style={{ fontSize: 13, color: "#64748b", fontWeight: 600 }}>{titulo}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: cor, marginTop: 6 }}>{formatarMoeda(valor)}</div>
    </div>
  );
}

function Lancamentos({
  podeCriar,
  podeBaixar,
  podeExcluir,
}: {
  podeCriar: boolean;
  podeBaixar: boolean;
  podeExcluir: boolean;
}) {
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [resumo, setResumo] = useState<ResumoFinanceiro | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("");
  const [searchParams] = useSearchParams();
  const [mostrarModal, setMostrarModal] = useState(() => searchParams.get("novo") === "1");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [cobrancaAlvo, setCobrancaAlvo] = useState<Lancamento | null>(null);

  const carregar = async () => {
    setCarregando(true);
    try {
      const [lan, res] = await Promise.all([
        listarLancamentos({
          ...(filtroStatus ? { status: filtroStatus as StatusLancamento } : {}),
          ...(filtroTipo ? { tipo: filtroTipo as TipoLancamento } : {}),
        }),
        obterResumo(),
      ]);
      setLancamentos(lan);
      setResumo(res);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroStatus, filtroTipo]);

  const baixar = async (id: string) => {
    if (!confirm("Confirmar recebimento deste lançamento?")) return;
    await baixarLancamento(id);
    carregar();
  };

  const cancelar = async (id: string) => {
    if (!confirm("Cancelar este lançamento?")) return;
    await cancelarLancamento(id);
    carregar();
  };

  const excluir = async (id: string) => {
    if (!confirm("Excluir definitivamente este lançamento?")) return;
    await excluirLancamento(id);
    carregar();
  };

  if (carregando) return <p>Carregando...</p>;

  return (
    <div>
      {resumo && (
        <div className="toolbar">
          <CartaoResumo titulo="Recebido" valor={resumo.totalRecebido} cor="var(--cor-sucesso)" />
          <CartaoResumo titulo="A receber" valor={resumo.aReceber} cor="#d97706" />
          <CartaoResumo titulo="Inadimplência" valor={resumo.inadimplencia} cor="#b91c1c" />
          <CartaoResumo titulo="Despesas" valor={resumo.totalDespesas} cor="#475569" />
          <CartaoResumo titulo="Saldo" valor={resumo.saldo} cor={resumo.saldo >= 0 ? "var(--cor-primaria)" : "#b91c1c"} />
        </div>
      )}

      <div className="toolbar justify-between align-center mb-1">
        <div className="flex-row align-center gap-1">
          <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)} className="input-compact">
            <option value="">Todos os tipos</option>
            <option value="receita">Receitas</option>
            <option value="despesa">Despesas</option>
          </select>
          <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)} className="input-compact">
            <option value="">Todos os status</option>
            <option value="pendente">Pendentes</option>
            <option value="pago">Pagos</option>
            <option value="cancelado">Cancelados</option>
          </select>
        </div>
        {podeCriar && (
          <button className="btn-novo" onClick={() => setMostrarModal(true)}>
            + Novo lançamento
          </button>
        )}
      </div>

      {lancamentos.length === 0 ? (
        <div className="aviso-vazio">Nenhum lançamento encontrado.</div>
      ) : (
        <div className="table-responsive">
          <table className="tabela-pacientes">
            <thead>
              <tr>
                <th>Data</th>
                <th>Tipo</th>
                <th>Descrição</th>
                <th>Paciente</th>
                <th>Forma</th>
                <th>Parcela</th>
                <th style={{ textAlign: "right" }}>Valor</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {lancamentos.map((l) => (
                <tr key={l.id}>
                  <td>{formatarData(l.dataVencimento || l.criadoEm)}</td>
                  <td>
                    <span className={`status-cargo ${l.tipo === "receita" ? "status-ativo" : ""}`}>
                      {l.tipo === "receita" ? "Receita" : "Despesa"}
                    </span>
                  </td>
                  <td>
                    {l.descricao}
                    {l.comissao !== null && (
                      <span style={{ fontSize: 12, color: "#64748b" }}> (comissão {formatarMoeda(l.comissao)})</span>
                    )}
                  </td>
                  <td>{l.paciente?.nome || "—"}</td>
                  <td>{l.formaPagamento ? LABELS_FORMA[l.formaPagamento] : "—"}</td>
                  <td>
                    {l.quantidadeParcelas > 1 ? (
                      <span className="status-cargo">{l.numeroParcela}/{l.quantidadeParcelas}</span>
                    ) : "—"}
                  </td>
                  <td className="text-right" style={{ fontWeight: 600, color: l.tipo === "receita" ? "var(--cor-sucesso)" : "#b91c1c" }}>
                    {l.tipo === "receita" ? "+ " : "− "}{formatarMoeda(l.valor)}
                  </td>
                  <td>
                    <span className={`status-cargo ${l.status === "pago" ? "status-ativo" : l.status === "cancelado" ? "status-inativo" : "status-pendente"}`}
                      style={l.status === "pendente" ? { background: "#fef3c7", color: "#92400e" } : undefined}>
                      {LABELS_STATUS[l.status]}
                    </span>
                  </td>
                  <td>
                    <div className="modal-actions">
                      {podeBaixar && l.status === "pendente" && l.tipo === "receita" && (
                        <button className="btn btn-primary btn-sm" onClick={() => baixar(l.id)}>Receber</button>
                      )}
                      {podeCriar && l.status === "pendente" && l.tipo === "receita" && (
                        <button className="btn btn-secondary btn-sm" onClick={() => setCobrancaAlvo(l)}>Cobrança</button>
                      )}
                      {podeExcluir && l.status === "pendente" && (
                        <button className="btn btn-secondary btn-sm" onClick={() => cancelar(l.id)}>Cancelar</button>
                      )}
                      {podeExcluir && l.status !== "pago" && (
                        <button className="btn-excluir" onClick={() => excluir(l.id)}>✕</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {mostrarModal && (
        <ModalLancamento
          onFechar={() => setMostrarModal(false)}
          onSalvo={() => {
            setMostrarModal(false);
            carregar();
          }}
          onErro={setErro}
          erro={erro}
          salvando={salvando}
          setSalvando={setSalvando}
        />
      )}

      {cobrancaAlvo && (
        <CobrancaModal
          lancamento={{ id: cobrancaAlvo.id, descricao: cobrancaAlvo.descricao, valor: cobrancaAlvo.valor }}
          onFechar={() => setCobrancaAlvo(null)}
          onConcluido={() => {
            setCobrancaAlvo(null);
            carregar();
          }}
        />
      )}
    </div>
  );
}

function ModalLancamento({
  onFechar,
  onSalvo,
  onErro,
  erro,
  salvando,
  setSalvando,
}: {
  onFechar: () => void;
  onSalvo: () => void;
  onErro: (msg: string) => void;
  erro: string;
  salvando: boolean;
  setSalvando: (v: boolean) => void;
}) {
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [profissionais, setProfissionais] = useState<Profissional[]>([]);
  const [procedimentos, setProcedimentos] = useState<Procedimento[]>([]);
  const [form, setForm] = useState<LancamentoInput>({
    tipo: "receita",
    descricao: "",
    valor: 0,
    formaPagamento: "pix",
    pacienteId: null,
    profissionalId: null,
    procedimentoId: null,
    dataVencimento: null,
    desconto: 0,
    quantidadeParcelas: 1,
    observacoes: "",
  });
  const [valorStr, setValorStr] = useState("");
  const [descontoStr, setDescontoStr] = useState("");
  const [parcelas, setParcelas] = useState("1");
  const [sugerindo, setSugerindo] = useState(false);

  useEffect(() => {
    Promise.all([listarPacientes(), listarProfissionais(), listarProcedimentos()])
      .then(([p, pr, pc]) => {
        setPacientes(p);
        setProfissionais(pr);
        setProcedimentos(pc);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!form.procedimentoId) return;
    let ativo = true;
    setSugerindo(true);
    sugerirValorProcedimento(form.procedimentoId, form.pacienteId || undefined)
      .then((s) => {
        if (!ativo) return;
        setForm((f) => ({
          ...f,
          descricao: f.descricao || s.nome,
          valor: s.valorSugerido,
        }));
        setValorStr(mascaraMoeda(String(s.valorSugerido.toFixed(2))));
      })
      .catch(() => undefined)
      .finally(() => setSugerindo(false));
    return () => {
      ativo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.procedimentoId, form.pacienteId]);

  const salvar = async (e: FormEvent) => {
    e.preventDefault();
    const valor = parseMoeda(valorStr);
    if (valor <= 0) {
      onErro("Informe um valor válido maior que zero.");
      return;
    }
    if (!form.descricao.trim()) {
      onErro("Descreva o lançamento.");
      return;
    }
    const desconto = parseMoeda(descontoStr);
    const quantidadeParcelas = Math.max(1, Number(parcelas) || 1);
    if (desconto >= valor) {
      onErro("O desconto deve ser menor que o valor.");
      return;
    }
    setSalvando(true);
    onErro("");
    try {
      await criarLancamento({
        ...form,
        valor,
        desconto,
        quantidadeParcelas,
        descricao: form.descricao.trim(),
        dataVencimento: form.dataVencimento || new Date().toISOString(),
      });
      onSalvo();
    } catch (err: any) {
      onErro(err.response?.data?.error || "Erro ao salvar lançamento");
    } finally {
      setSalvando(false);
    }
  };

  const definirForma = (forma: FormaPagamento) => setForm({ ...form, formaPagamento: forma });

  const valorLiquido = Math.max(0, parseMoeda(valorStr) - parseMoeda(descontoStr));
  const valorParcela = Math.max(1, Number(parcelas) || 1);
  const parcelaStr = (valorLiquido / valorParcela).toFixed(2).replace(".", ",");

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 720 }}>
        <div className="modal-titulo">
          <h3>Novo lançamento</h3>
          <button className="modal-fechar" onClick={onFechar}>✕</button>
        </div>
        <form onSubmit={salvar}>
          <div className="grid-2">
            <div className="field">
              <label>Tipo *</label>
              <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value as TipoLancamento })}>
                <option value="receita">Receita</option>
                <option value="despesa">Despesa</option>
              </select>
            </div>
            <div className="field">
              <label>Paciente</label>
              <select value={form.pacienteId || ""} onChange={(e) => setForm({ ...form, pacienteId: e.target.value || null })}>
                <option value="">—</option>
                {pacientes.map((p) => (
                  <option key={p.id} value={p.id}>{p.nome}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid-2">
            <div className="field">
              <label>Procedimento (preenche valores)</label>
              <select value={form.procedimentoId || ""} onChange={(e) => setForm({ ...form, procedimentoId: e.target.value || null, descricao: e.target.value ? "" : form.descricao })}>
                <option value="">—</option>
                {procedimentos.map((p) => (
                  <option key={p.id} value={p.id}>{p.nome}</option>
                ))}
              </select>
              {sugerindo && <p style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>Buscando valor sugerido...</p>}
            </div>
            <div className="field">
              <label>Profissional responsável</label>
              <select value={form.profissionalId || ""} onChange={(e) => setForm({ ...form, profissionalId: e.target.value || null })}>
                <option value="">—</option>
                {profissionais.map((p) => (
                  <option key={p.id} value={p.id}>{p.nome} ({p.cro})</option>
                ))}
              </select>
            </div>
          </div>
          <div className="field">
            <label>Descrição *</label>
            <input placeholder="Ex.: Restauração em resina, material de consumo..." value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
          </div>
          <div className="grid-2">
            <div className="field">
              <label>Valor bruto *</label>
              <input inputMode="decimal" placeholder="R$ 0,00" value={valorStr} onChange={(e) => setValorStr(mascaraMoeda(e.target.value))} />
            </div>
            <div className="field">
              <label>Desconto</label>
              <input inputMode="decimal" placeholder="R$ 0,00" value={descontoStr} onChange={(e) => setDescontoStr(mascaraMoeda(e.target.value))} />
            </div>
          </div>
          <div className="grid-2">
            <div className="field">
              <label>Parcelas</label>
              <select value={parcelas} onChange={(e) => setParcelas(e.target.value)}>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>{n === 1 ? "À vista (1x)" : `${n}x`}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Vencimento da 1ª parcela</label>
              <input type="date" value={form.dataVencimento ? form.dataVencimento.slice(0, 10) : ""} onChange={(e) => setForm({ ...form, dataVencimento: e.target.value ? new Date(e.target.value).toISOString() : null })} />
            </div>
          </div>
          {form.tipo === "receita" && Number(parcelas) > 1 && (
            <p style={{ fontSize: 13, color: "#475569", marginBottom: 8 }}>
              Valor líquido <b>{formatarMoeda(valorLiquido)}</b> em {Number(parcelas)}x de <b>{parcelaStr}</b>
            </p>
          )}
          <div className="field">
            <label>Forma de pagamento</label>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {FORMAS.map((f) => (
                <button
                  key={f}
                  type="button"
                  className={`btn btn-sm ${form.formaPagamento === f ? "btn-primary" : "btn-secondary"}`}
                  onClick={() => definirForma(f)}
                >
                  {LABELS_FORMA[f]}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <label>Observações</label>
            <input value={form.observacoes || ""} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
          </div>
          <div className="field">
            <label style={{ fontSize: 13, color: "#475569" }}>Documentos</label>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {form.pacienteId && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    window.location.href = `/notas-fiscais?pacienteId=${form.pacienteId}&valor=${valorLiquido}&descricao=${encodeURIComponent(form.descricao)}&procedimentoId=${form.procedimentoId || ""}&provedor=proprio`;
                  }}
                >
                  NFS-e
                </button>
              )}
            </div>
            <p style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
              Após salvar o lançamento, use o botão "Cobrança" na tabela para gerar Pix, Boleto ou Cartão pelo gateway de pagamento. NFS-e abre a emissão no módulo Notas Fiscais.
            </p>
          </div>
          {erro && <p style={{ color: "var(--cor-perigo)", marginBottom: 8 }}>{erro}</p>}
          <div className="modal-acoes-status" style={{ justifyContent: "flex-end" }}>
            <button type="button" className="btn btn-secondary" onClick={onFechar}>Cancelar</button>
            <button className="btn btn-primary" disabled={salvando}>{salvando ? "Salvando..." : "Salvar"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Comissoes({ podeMarcar }: { podeMarcar: boolean }) {
  const [comissoes, setComissoes] = useState<Comissao[]>([]);
  const [carregando, setCarregando] = useState(true);

  const carregar = async () => {
    setCarregando(true);
    try {
      setComissoes(await listarComissoes());
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregar();
  }, []);

  const marcarPaga = async (id: string) => {
    if (!confirm("Marcar esta comissão como paga?")) return;
    await marcarComissaoPaga(id);
    carregar();
  };

  if (carregando) return <p>Carregando...</p>;

  return (
    <div>
      <p style={{ fontSize: 14, color: "#475569", marginBottom: "1rem" }}>
        Comissões geradas automaticamente a partir das receitas lançadas (percentual configurado por profissional).
      </p>
      {comissoes.length === 0 ? (
        <div className="aviso-vazio">Nenhuma comissão gerada.</div>
      ) : (
        <div className="historico-cards">
          {comissoes.map((c) => (
            <div className="card" key={c.id}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
                <div>
                  <b>{c.profissional.nome}</b>
                  <span style={{ fontSize: 12, color: "#64748b" }}> — {c.lancamento.descricao}</span>
                </div>
                <span className="status-cargo" style={c.paga ? undefined : { background: "#fef3c7", color: "#92400e" }}>
                  {c.paga ? "Paga" : "A pagar"}
                </span>
              </div>
              <div style={{ fontSize: 13, color: "#475569", display: "grid", gap: 3 }}>
                <span>Paciente: {c.lancamento.pacienteNome || "—"}</span>
                <span>
                  Valor do lançamento: {formatarMoeda(c.lancamento.valor)} • {c.percentual}% ={" "}
                  <b>{formatarMoeda(c.valor)}</b>
                </span>
                <span>Data: {formatarData(c.lancamento.dataPagamento || c.criadoEm)}</span>
              </div>
              {!c.paga && podeMarcar && (
                <div style={{ marginTop: 8 }}>
                  <button className="btn btn-primary btn-sm" onClick={() => marcarPaga(c.id)}>
                    Marcar como paga
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
