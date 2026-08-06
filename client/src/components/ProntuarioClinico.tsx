import { FormEvent, useEffect, useState } from "react";
import {
  atualizarDente,
  assinarTermo,
  CondicaoDente,
  criarEvolucao,
  criarExame,
  criarReceituario,
  criarTermo,
  Evolucao,
  EvolucaoInput,
  Exame,
  excluirEvolucao,
  excluirExame,
  excluirReceituario,
  excluirTermo,
  listarEvolucoes,
  listarExames,
  listarReceituarios,
  listarTermos,
  obterOdontograma,
  Receituario,
  ReceituarioInput,
  resetarOdontograma,
  TermoConsentimento,
} from "../services/prontuario";
import { listarProfissionais, Profissional } from "../services/profissionais";
import { usePermissao } from "../context/PermissaoContext";

type SubAba = "odontograma" | "evolucoes" | "exames" | "receituarios" | "termos";

interface Dente {
  numero: number;
  condicao: CondicaoDente;
  observacao: string | null;
  fdi: string;
  face: "superior" | "inferior";
}

const CONDICOES: { valor: CondicaoDente; label: string; cor: string }[] = [
  { valor: "saudavel", label: "Saudável", cor: "#ffffff" },
  { valor: "carie", label: "Cárie", cor: "#b91c1c" },
  { valor: "restauracao", label: "Restauração", cor: "#1d4ed8" },
  { valor: "extraido", label: "Extraído", cor: "#374151" },
  { valor: "canal", label: "Canal", cor: "#a16207" },
  { valor: "coroa", label: "Coroa", cor: "#9333ea" },
  { valor: "implante", label: "Implante", cor: "#0f766e" },
  { valor: "ausente", label: "Ausente", cor: "#f3f4f6" },
];

const POSICOES = [
  { numero: 1, fdi: "18", face: "superior" as const },
  { numero: 2, fdi: "17", face: "superior" as const },
  { numero: 3, fdi: "16", face: "superior" as const },
  { numero: 4, fdi: "15", face: "superior" as const },
  { numero: 5, fdi: "14", face: "superior" as const },
  { numero: 6, fdi: "13", face: "superior" as const },
  { numero: 7, fdi: "12", face: "superior" as const },
  { numero: 8, fdi: "11", face: "superior" as const },
  { numero: 9, fdi: "21", face: "superior" as const },
  { numero: 10, fdi: "22", face: "superior" as const },
  { numero: 11, fdi: "23", face: "superior" as const },
  { numero: 12, fdi: "24", face: "superior" as const },
  { numero: 13, fdi: "25", face: "superior" as const },
  { numero: 14, fdi: "26", face: "superior" as const },
  { numero: 15, fdi: "27", face: "superior" as const },
  { numero: 16, fdi: "28", face: "superior" as const },
  { numero: 17, fdi: "38", face: "inferior" as const },
  { numero: 18, fdi: "37", face: "inferior" as const },
  { numero: 19, fdi: "36", face: "inferior" as const },
  { numero: 20, fdi: "35", face: "inferior" as const },
  { numero: 21, fdi: "34", face: "inferior" as const },
  { numero: 22, fdi: "33", face: "inferior" as const },
  { numero: 23, fdi: "32", face: "inferior" as const },
  { numero: 24, fdi: "31", face: "inferior" as const },
  { numero: 25, fdi: "41", face: "inferior" as const },
  { numero: 26, fdi: "42", face: "inferior" as const },
  { numero: 27, fdi: "43", face: "inferior" as const },
  { numero: 28, fdi: "44", face: "inferior" as const },
  { numero: 29, fdi: "45", face: "inferior" as const },
  { numero: 30, fdi: "46", face: "inferior" as const },
  { numero: 31, fdi: "47", face: "inferior" as const },
  { numero: 32, fdi: "48", face: "inferior" as const },
];

function corDaCondicao(condicao: CondicaoDente): string {
  return CONDICOES.find((c) => c.valor === condicao)?.cor || "#ffffff";
}

function formatarData(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export default function ProntuarioClinico({ pacienteId }: { pacienteId: string }) {
  const [subAba, setSubAba] = useState<SubAba>("odontograma");
  const { temPermissao } = usePermissao();
  const podeEditar = temPermissao("prontuario.editar");

  return (
    <div>
      <div className="agenda-tabs" style={{ marginBottom: "1.25rem" }}>
        {([
          { chave: "odontograma", label: "Odontograma" },
          { chave: "evolucoes", label: "Evoluções" },
          { chave: "exames", label: "Exames e Imagens" },
          { chave: "receituarios", label: "Receituários" },
          { chave: "termos", label: "Termos de Consentimento" },
        ] as { chave: SubAba; label: string }[]).map((a) => (
          <button
            key={a.chave}
            className={`agenda-tab ${subAba === a.chave ? "ativo" : ""}`}
            onClick={() => setSubAba(a.chave)}
          >
            {a.label}
          </button>
        ))}
      </div>

      {subAba === "odontograma" && <Odontograma pacienteId={pacienteId} podeEditar={podeEditar} />}
      {subAba === "evolucoes" && <Evolucoes pacienteId={pacienteId} podeEditar={podeEditar} />}
      {subAba === "exames" && <Exames pacienteId={pacienteId} podeEditar={podeEditar} />}
      {subAba === "receituarios" && <Receituarios pacienteId={pacienteId} podeEditar={podeEditar} />}
      {subAba === "termos" && <Termos pacienteId={pacienteId} podeEditar={podeEditar} />}
    </div>
  );
}

function Odontograma({ pacienteId, podeEditar }: { pacienteId: string; podeEditar: boolean }) {
  const [dentes, setDentes] = useState<Record<number, Dente>>({});
  const [carregando, setCarregando] = useState(true);
  const [selecionado, setSelecionado] = useState<Dente | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  const carregar = async () => {
    setCarregando(true);
    try {
      const od = await obterOdontograma(pacienteId);
      const mapa: Record<number, Dente> = {};
      for (const pos of POSICOES) {
        const info = od.dentes[pos.numero];
        mapa[pos.numero] = {
          numero: pos.numero,
          fdi: pos.fdi,
          face: pos.face,
          condicao: info?.condicao || "saudavel",
          observacao: info?.observacao ?? null,
        };
      }
      setDentes(mapa);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pacienteId]);

  const selecionadoAtual = selecionado ? dentes[selecionado.numero] : null;

  const salvarDente = async () => {
    if (!selecionadoAtual) return;
    setSalvando(true);
    setErro("");
    try {
      await atualizarDente(pacienteId, {
        numero: selecionadoAtual.numero,
        condicao: selecionadoAtual.condicao,
        observacao: selecionadoAtual.observacao,
      });
      setDentes({ ...dentes });
      setSelecionado(null);
    } catch (e: any) {
      setErro(e.response?.data?.error || "Erro ao salvar o dente");
    } finally {
      setSalvando(false);
    }
  };

  const marcar = (condicao: CondicaoDente) => {
    if (!selecionadoAtual) return;
    setDentes({ ...dentes, [selecionadoAtual.numero]: { ...selecionadoAtual, condicao } });
  };

  const limparTudo = async () => {
    if (!confirm("Limpar todo o odontograma? Esta ação não pode ser desfeita.")) return;
    await resetarOdontograma(pacienteId);
    carregar();
  };

  const superiores = POSICOES.filter((p) => p.face === "superior");
  const inferiores = POSICOES.filter((p) => p.face === "inferior");

  const renderArco = (arcos: typeof POSICOES) => (
    <div style={{ display: "flex", gap: 4, justifyContent: "center", flexWrap: "wrap", marginBottom: 8 }}>
      {arcos.map((pos) => {
        const d = dentes[pos.numero];
        const condicao = d?.condicao || "saudavel";
        return (
          <div key={pos.numero} style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 42 }}>
            <span style={{ fontSize: 10, color: "#64748b" }}>{pos.fdi}</span>
            <div
              onClick={() => podeEditar && setSelecionado(d)}
              title={`Dente ${pos.fdi}`}
              style={{
                width: 34,
                height: 40,
                border: "1px solid #94a3b8",
                borderRadius: 8,
                background: corDaCondicao(condicao),
                cursor: podeEditar ? "pointer" : "default",
                boxShadow: selecionado?.numero === pos.numero ? "0 0 0 2px #2563eb" : "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 10,
                color: condicao === "extraido" || condicao === "ausente" ? "#9ca3af" : "#0f172a",
                fontWeight: 700,
              }}
            >
              {condicao === "extraido" ? "✕" : condicao === "ausente" ? "–" : pos.numero}
            </div>
          </div>
        );
      })}
    </div>
  );

  if (carregando) return <p>Carregando odontograma...</p>;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <div className="agenda-legenda" style={{ flexWrap: "wrap", gap: 8 }}>
          {CONDICOES.map((c) => (
            <span key={c.valor} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12 }}>
              <span style={{ width: 12, height: 12, borderRadius: 3, background: c.cor, border: "1px solid #94a3b8", display: "inline-block" }} />
              {c.label}
            </span>
          ))}
        </div>
        {podeEditar && (
          <button className="btn btn-danger btn-sm" onClick={limparTudo}>Limpar odontograma</button>
        )}
      </div>

      <div className="card">
        <p style={{ textAlign: "center", fontWeight: 600, fontSize: 12, color: "#475569", letterSpacing: 1 }}>ARCO SUPERIOR</p>
        {renderArco(superiores)}
        <div style={{ textAlign: "center", margin: "8px 0" }}><b style={{ color: "#94a3b8" }}>⚭</b></div>
        {renderArco(inferiores)}
        <p style={{ textAlign: "center", fontWeight: 600, fontSize: 12, color: "#475569", letterSpacing: 1 }}>ARCO INFERIOR</p>
      </div>

      {selecionadoAtual && (
        <div className="card" style={{ marginTop: 16 }}>
          <h3 style={{ marginBottom: 12 }}>Dente {selecionadoAtual.fdi}</h3>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
            {CONDICOES.map((c) => (
              <button
                key={c.valor}
                type="button"
                className="btn btn-sm"
                style={{
                  background: selecionadoAtual.condicao === c.valor ? "var(--cor-primaria)" : "#e2e8f0",
                  color: selecionadoAtual.condicao === c.valor ? "#fff" : "#334155",
                  border: "1px solid #cbd5e1",
                }}
                onClick={() => marcar(c.valor)}
              >
                {c.label}
              </button>
            ))}
          </div>
          <div className="field">
            <label>Observação</label>
            <textarea
              rows={2}
              placeholder="Ex.: Cárie proximal, restauração insatisfatória..."
              value={selecionadoAtual.observacao || ""}
              onChange={(e) =>
                setDentes({ ...dentes, [selecionadoAtual.numero]: { ...selecionadoAtual, observacao: e.target.value } })
              }
            />
          </div>
          {erro && <p style={{ color: "var(--cor-perigo)", marginBottom: 8 }}>{erro}</p>}
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-primary" onClick={salvarDente} disabled={salvando}>
              {salvando ? "Salvando..." : "Salvar"}
            </button>
            <button className="btn btn-secondary" onClick={() => setSelecionado(null)}>Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Evolucoes({ pacienteId, podeEditar }: { pacienteId: string; podeEditar: boolean }) {
  const [evolucoes, setEvolucoes] = useState<Evolucao[]>([]);
  const [profissionais, setProfissionais] = useState<Profissional[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [form, setForm] = useState<EvolucaoInput>({ profissionalId: "", descricao: "", conduta: "", data: null });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  const carregar = async () => {
    try {
      const [evs, profs] = await Promise.all([listarEvolucoes(pacienteId), listarProfissionais()]);
      setEvolucoes(evs);
      setProfissionais(profs);
      setForm((f) => ({ ...f, profissionalId: f.profissionalId || profs[0]?.id || "" }));
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pacienteId]);

  const salvar = async (e: FormEvent) => {
    e.preventDefault();
    setErro("");
    if (!form.profissionalId) {
      setErro("Selecione o profissional responsável.");
      return;
    }
    if (!form.descricao.trim()) {
      setErro("Descreva a evolução do atendimento.");
      return;
    }
    setSalvando(true);
    try {
      await criarEvolucao(pacienteId, { ...form, descricao: form.descricao.trim(), conduta: form.conduta || null });
      setForm({ profissionalId: form.profissionalId, descricao: "", conduta: "", data: null });
      carregar();
    } catch (err: any) {
      setErro(err.response?.data?.error || "Erro ao salvar evolução");
    } finally {
      setSalvando(false);
    }
  };

  const remover = async (id: string) => {
    if (!confirm("Excluir esta evolução?")) return;
    await excluirEvolucao(pacienteId, id);
    carregar();
  };

  if (carregando) return <p>Carregando...</p>;

  return (
    <div>
      {podeEditar && (
        <form className="card" onSubmit={salvar}>
          <h3 style={{ marginBottom: 16 }}>Nova evolução</h3>
          <div className="field">
            <label>Data e hora</label>
            <input
              type="datetime-local"
              value={form.data || ""}
              onChange={(e) => setForm({ ...form, data: e.target.value ? new Date(e.target.value).toISOString() : null })}
            />
          </div>
          <div className="field">
            <label>Profissional *</label>
            <select value={form.profissionalId} onChange={(e) => setForm({ ...form, profissionalId: e.target.value })}>
              {profissionais.map((p) => (
                <option key={p.id} value={p.id}>{p.nome}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Descrição do atendimento *</label>
            <textarea rows={3} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
          </div>
          <div className="field">
            <label>Conduta</label>
            <textarea rows={2} placeholder="Orientação, medicamentos, retorno..." value={form.conduta || ""} onChange={(e) => setForm({ ...form, conduta: e.target.value })} />
          </div>
          {erro && <p style={{ color: "var(--cor-perigo)", marginBottom: 8 }}>{erro}</p>}
          <button className="btn btn-primary" disabled={salvando}>{salvando ? "Salvando..." : "Adicionar evolução"}</button>
        </form>
      )}

      {evolucoes.length === 0 ? (
        <div className="aviso-vazio">Nenhuma evolução registrada.</div>
      ) : (
        <div className="historico-cards">
          {evolucoes.map((e) => (
            <div className="card" key={e.id}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div style={{ fontSize: 12, color: "#64748b" }}>
                  {formatarData(e.criadoEm)} • <b>{e.profissional.nome}</b>
                </div>
                {podeEditar && (
                  <button className="btn-excluir" onClick={() => remover(e.id)}>Excluir</button>
                )}
              </div>
              <p style={{ fontSize: 14, whiteSpace: "pre-wrap" }}>{e.descricao}</p>
              {e.conduta && (
                <p style={{ fontSize: 14, marginTop: 8 }}>
                  <b style={{ color: "var(--cor-primaria)" }}>Conduta: </b>
                  <span style={{ whiteSpace: "pre-wrap" }}>{e.conduta}</span>
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Exames({ pacienteId, podeEditar }: { pacienteId: string; podeEditar: boolean }) {
  const [exames, setExames] = useState<Exame[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [tipo, setTipo] = useState<"imagem" | "laudo">("imagem");
  const [descricao, setDescricao] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  const carregar = async () => {
    try {
      setExames(await listarExames(pacienteId));
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pacienteId]);

  const salvar = async (e: FormEvent) => {
    e.preventDefault();
    setErro("");
    if (tipo === "imagem" && !arquivo) {
      setErro("Selecione um arquivo de imagem.");
      return;
    }
    if (tipo === "laudo" && !descricao.trim()) {
      setErro("Informe o texto do laudo.");
      return;
    }
    setSalvando(true);
    try {
      await criarExame(pacienteId, { tipo, descricao: descricao || null, arquivo: arquivo! });
      setDescricao("");
      setArquivo(null);
      carregar();
    } catch (err: any) {
      setErro(err.response?.data?.error || "Erro ao salvar exame");
    } finally {
      setSalvando(false);
    }
  };

  const remover = async (id: string) => {
    if (!confirm("Excluir este exame?")) return;
    await excluirExame(pacienteId, id);
    carregar();
  };

  if (carregando) return <p>Carregando...</p>;

  return (
    <div>
      {podeEditar && (
        <form className="card" onSubmit={salvar}>
          <h3 style={{ marginBottom: 16 }}>Novo exame / imagem</h3>
          <div className="grid-2">
            <div className="field">
              <label>Tipo</label>
              <select value={tipo} onChange={(e) => setTipo(e.target.value as "imagem" | "laudo")}>
                <option value="imagem">Imagem (radiografia / foto)</option>
                <option value="laudo">Laudo</option>
              </select>
            </div>
            <div className="field">
              <label>Descrição</label>
              <input placeholder="Ex.: Panorâmica, periapical, exame de entrada..." value={descricao} onChange={(e) => setDescricao(e.target.value)} />
            </div>
          </div>
          {tipo === "laudo" ? (
            <div className="field">
              <label>Texto do laudo</label>
              <textarea rows={3} value={descricao} onChange={(e) => setDescricao(e.target.value)} required />
            </div>
          ) : (
            <div className="field">
              <label>Arquivo (JPG, PNG, GIF, WEBP ou PDF)</label>
              <input type="file" accept=".jpg,.jpeg,.png,.gif,.webp,.pdf" onChange={(e) => setArquivo(e.target.files?.[0] || null)} required />
            </div>
          )}
          {erro && <p style={{ color: "var(--cor-perigo)", marginBottom: 8 }}>{erro}</p>}
          <button className="btn btn-primary" disabled={salvando}>{salvando ? "Salvando..." : "Adicionar exame"}</button>
        </form>
      )}

      {exames.length === 0 ? (
        <div className="aviso-vazio">Nenhum exame ou imagem registrado.</div>
      ) : (
        <div className="historico-cards">
          {exames.map((x) => (
            <div className="card" key={x.id}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <b>{x.tipo === "imagem" ? "Imagem" : "Laudo"}{x.descricao ? ` — ${x.descricao}` : ""}</b>
                {podeEditar && <button className="btn-excluir" onClick={() => remover(x.id)}>Excluir</button>}
              </div>
              <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8 }}>{formatarData(x.criadoEm)}</div>
              {x.tipo === "laudo" ? (
                <p style={{ fontSize: 14, whiteSpace: "pre-wrap" }}>{x.descricao}</p>
              ) : x.arquivoUrl ? (
                x.arquivoUrl.toLowerCase().endsWith(".pdf") ? (
                  <a href={x.arquivoUrl} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">
                    Abrir PDF ({x.arquivoNome})
                  </a>
                ) : (
                  <a href={x.arquivoUrl} target="_blank" rel="noreferrer">
                    <img
                      src={x.arquivoUrl}
                      alt={x.arquivoNome || "Imagem"}
                      style={{ maxWidth: "100%", maxHeight: 240, borderRadius: 8, cursor: "pointer" }}
                    />
                  </a>
                )
              ) : (
                <span style={{ fontSize: 13, color: "#64748b" }}>Sem arquivo</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Receituarios({ pacienteId, podeEditar }: { pacienteId: string; podeEditar: boolean }) {
  const [receituarios, setReceituarios] = useState<Receituario[]>([]);
  const [profissionais, setProfissionais] = useState<Profissional[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [form, setForm] = useState<ReceituarioInput>({
    profissionalId: "",
    medicamentos: [{ nome: "", posologia: "", quantidade: "" }],
    instrucoes: "",
    assinatura: "",
  });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  const carregar = async () => {
    try {
      const [recs, profs] = await Promise.all([listarReceituarios(pacienteId), listarProfissionais()]);
      setReceituarios(recs);
      setProfissionais(profs);
      setForm((f) => ({ ...f, profissionalId: f.profissionalId || profs[0]?.id || "" }));
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pacienteId]);

  const atualizarMed = (i: number, campo: "nome" | "posologia" | "quantidade", valor: string) => {
    setForm({
      ...form,
      medicamentos: form.medicamentos.map((m, idx) => (idx === i ? { ...m, [campo]: valor } : m)),
    });
  };

  const adicionarMed = () => {
    if (form.medicamentos.length >= 10) return;
    setForm({ ...form, medicamentos: [...form.medicamentos, { nome: "", posologia: "", quantidade: "" }] });
  };

  const removerMed = (i: number) => {
    if (form.medicamentos.length === 1) return;
    setForm({ ...form, medicamentos: form.medicamentos.filter((_, idx) => idx !== i) });
  };

  const salvar = async (e: FormEvent) => {
    e.preventDefault();
    setErro("");
    if (!form.profissionalId) {
      setErro("Selecione o profissional.");
      return;
    }
    if (!form.medicamentos[0]?.nome.trim()) {
      setErro("Informe pelo menos um medicamento.");
      return;
    }
    setSalvando(true);
    try {
      const dados: ReceituarioInput = {
        profissionalId: form.profissionalId,
        medicamentos: form.medicamentos.filter((m) => m.nome.trim()).map((m) => ({
          nome: m.nome.trim(),
          posologia: m.posologia.trim(),
          quantidade: m.quantidade?.trim() || null,
        })),
        instrucoes: form.instrucoes?.trim() || null,
        assinatura: form.assinatura?.trim() || null,
      };
      await criarReceituario(pacienteId, dados);
      setForm({ ...form, medicamentos: [{ nome: "", posologia: "", quantidade: "" }], instrucoes: "", assinatura: "" });
      carregar();
    } catch (err: any) {
      setErro(err.response?.data?.error || "Erro ao salvar receituário");
    } finally {
      setSalvando(false);
    }
  };

  const remover = async (id: string) => {
    if (!confirm("Excluir este receituário?")) return;
    await excluirReceituario(pacienteId, id);
    carregar();
  };

  const imprimir = (r: Receituario) => {
    const janela = window.open("", "_blank", "width=800,height=600");
    if (!janela) return;
    const medicamentos = r.medicamentos
      .map(
        (m) =>
          `<li><b>${m.nome}</b> — ${m.posologia}${m.quantidade ? ` (${m.quantidade})` : ""}</li>`
      )
      .join("");
    janela.document.write(`
      <html><head><title>Receituário</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 40px; }
        h1 { font-size: 18px; letter-spacing: 2px; border-bottom: 2px solid #000; padding-bottom: 8px; }
        .linha { margin: 8px 0; }
      </style></head>
      <body>
        <h1>RECEITUÁRIO</h1>
        <div class="linha"><b>Paciente:</b> <span id="paciente"></span></div>
        <div class="linha"><b>Data:</b> ${new Date(r.criadoEm).toLocaleString("pt-BR")}</div>
        <div class="linha"><b>Profissional:</b> ${r.profissional.nome}${r.profissional.cro ? ` (CRO ${r.profissional.cro})` : ""}</div>
        <h3>Medicamentos</h3>
        <ul>${medicamentos}</ul>
        ${r.instrucoes ? `<div class="linha"><b>Instruções:</b> ${r.instrucoes}</div>` : ""}
        <div style="margin-top: 60px;">Assinatura: <u style="font-size: 16px;">${r.assinatura || "_____________________"}</u></div>
      </body></html>`);
    janela.document.close();
    janela.focus();
    setTimeout(() => janela.print(), 300);
  };

  if (carregando) return <p>Carregando...</p>;

  return (
    <div>
      {podeEditar && (
        <form className="card" onSubmit={salvar}>
          <h3 style={{ marginBottom: 16 }}>Novo receituário</h3>
          <div className="field">
            <label>Profissional *</label>
            <select value={form.profissionalId} onChange={(e) => setForm({ ...form, profissionalId: e.target.value })}>
              {profissionais.map((p) => (
                <option key={p.id} value={p.id}>{p.nome}</option>
              ))}
            </select>
          </div>
          {form.medicamentos.map((m, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 120px auto", gap: 8, marginBottom: 8 }}>
              <input placeholder="Medicamento *" value={m.nome} onChange={(e) => atualizarMed(i, "nome", e.target.value)} />
              <input placeholder="Posologia" value={m.posologia} onChange={(e) => atualizarMed(i, "posologia", e.target.value)} />
              <input placeholder="Qtd." value={m.quantidade || ""} onChange={(e) => atualizarMed(i, "quantidade", e.target.value)} />
              <button type="button" className="btn btn-danger btn-sm" onClick={() => removerMed(i)}>✕</button>
            </div>
          ))}
          <button type="button" className="btn btn-secondary btn-sm" onClick={adicionarMed}>+ Adicionar medicamento</button>
          <div className="field" style={{ marginTop: 12 }}>
            <label>Instruções gerais</label>
            <textarea rows={2} placeholder="Ex.: Tomar após as refeições, não usar se tiver alergia..." value={form.instrucoes || ""} onChange={(e) => setForm({ ...form, instrucoes: e.target.value })} />
          </div>
          <div className="field">
            <label>Assinatura digital (nome do profissional)</label>
            <input placeholder="Nome para assinatura" value={form.assinatura || ""} onChange={(e) => setForm({ ...form, assinatura: e.target.value })} />
          </div>
          {erro && <p style={{ color: "var(--cor-perigo)", marginBottom: 8 }}>{erro}</p>}
          <button className="btn btn-primary" disabled={salvando}>{salvando ? "Salvando..." : "Gerar receituário"}</button>
        </form>
      )}

      {receituarios.length === 0 ? (
        <div className="aviso-vazio">Nenhum receituário gerado.</div>
      ) : (
        <div className="historico-cards">
          {receituarios.map((r) => (
            <div className="card" key={r.id}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div style={{ fontSize: 12, color: "#64748b" }}>
                  {formatarData(r.criadoEm)} • <b>{r.profissional.nome}</b>
                  {r.profissional.cro ? ` (CRO ${r.profissional.cro})` : ""}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => imprimir(r)}>Imprimir</button>
                  {podeEditar && <button className="btn-excluir" onClick={() => remover(r.id)}>Excluir</button>}
                </div>
              </div>
              <ul style={{ fontSize: 14, margin: "0 0 8px 18px" }}>
                {r.medicamentos.map((m, i) => (
                  <li key={i} style={{ marginBottom: 4 }}>
                    <b>{m.nome}</b> — {m.posologia}
                    {m.quantidade ? ` (${m.quantidade})` : ""}
                  </li>
                ))}
              </ul>
              {r.instrucoes && <p style={{ fontSize: 14, whiteSpace: "pre-wrap" }}>{r.instrucoes}</p>}
              <p style={{ fontSize: 13, color: "#475569", marginTop: 8 }}>
                Assinatura: <b>{r.assinatura || "—"}</b>
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Termos({ pacienteId, podeEditar }: { pacienteId: string; podeEditar: boolean }) {
  const [termos, setTermos] = useState<TermoConsentimento[]>([]);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [profissionais, setProfissionais] = useState<Profissional[]>([]);
  const [form, setForm] = useState({
    titulo: "",
    conteudo: "",
    profissionalId: "",
  });

  const carregar = async () => {
    setCarregando(true);
    try {
      const [ts, profs] = await Promise.all([listarTermos(pacienteId), listarProfissionais()]);
      setTermos(ts);
      setProfissionais(profs);
    } catch (e: any) {
      setErro(e.response?.data?.error || "Erro ao carregar termos");
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pacienteId]);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setErro("");
    setSalvando(true);
    try {
      await criarTermo(pacienteId, {
        titulo: form.titulo,
        conteudo: form.conteudo,
        profissionalId: form.profissionalId || null,
      });
      setForm({ titulo: "", conteudo: "", profissionalId: "" });
      setMostrarForm(false);
      carregar();
    } catch (e: any) {
      setErro(e.response?.data?.error || "Erro ao salvar termo");
    } finally {
      setSalvando(false);
    }
  }

  async function assinar(termo: TermoConsentimento) {
    if (!confirm(`Confirmar assinatura do termo "${termo.titulo}"?`)) return;
    try {
      await assinarTermo(pacienteId, termo.id);
      carregar();
    } catch (e: any) {
      alert(e.response?.data?.error || "Erro ao assinar termo");
    }
  }

  async function remover(termo: TermoConsentimento) {
    if (!confirm(`Excluir o termo "${termo.titulo}"?`)) return;
    try {
      await excluirTermo(pacienteId, termo.id);
      carregar();
    } catch (e: any) {
      alert(e.response?.data?.error || "Erro ao excluir termo");
    }
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h3 style={{ margin: 0 }}>Termos de consentimento</h3>
        {podeEditar && (
          <button className="btn-novo" onClick={() => setMostrarForm((v) => !v)}>
            {mostrarForm ? "Fechar" : "+ Novo termo"}
          </button>
        )}
      </div>

      {erro && <p style={{ color: "var(--cor-perigo)", marginBottom: 12 }}>{erro}</p>}

      {mostrarForm && (
        <form className="card" onSubmit={salvar} style={{ marginBottom: "1.25rem", display: "grid", gap: 10 }}>
          <div>
            <label>Título</label>
            <input
              value={form.titulo}
              onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
              placeholder="Ex.: Tratamento ortodôntico, Cirurgia, Uso de imagem"
              required
            />
          </div>
          <div>
            <label>Profissional responsável</label>
            <select value={form.profissionalId} onChange={(e) => setForm((f) => ({ ...f, profissionalId: e.target.value }))}>
              <option value="">— Selecione —</option>
              {profissionais.map((p) => (
                <option key={p.id} value={p.id}>{p.nome}</option>
              ))}
            </select>
          </div>
          <div>
            <label>Conteúdo do termo</label>
            <textarea
              rows={6}
              value={form.conteudo}
              onChange={(e) => setForm((f) => ({ ...f, conteudo: e.target.value }))}
              placeholder="Descreva o procedimento, riscos, benefícios e o que o paciente consente..."
              required
            />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-primary" type="submit" disabled={salvando}>
              {salvando ? "Salvando..." : "Salvar termo"}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setMostrarForm(false)}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      {carregando ? (
        <p>Carregando...</p>
      ) : termos.length === 0 ? (
        <p className="aviso-vazio">Nenhum termo de consentimento registrado para este paciente.</p>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {termos.map((t) => (
            <div key={t.id} className="card" style={{ borderLeft: t.assinado ? "4px solid var(--cor-sucesso)" : "4px solid #d97706" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                <div>
                  <b>{t.titulo}</b>
                  <span className={t.assinado ? "status-ativo" : "status-inativo"}>
                    {t.assinado ? "Assinado" : "Não assinado"}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  {!t.assinado && podeEditar && (
                    <button className="btn btn-primary btn-sm" onClick={() => assinar(t)}>Assinar</button>
                  )}
                  {podeEditar && (
                    <button className="btn btn-danger btn-sm" onClick={() => remover(t)}>Excluir</button>
                  )}
                </div>
              </div>
              {t.assinado && (
                <p style={{ fontSize: 13, color: "#475569", margin: "6px 0 0" }}>
                  Assinado em {t.dataAssinatura ? formatarData(t.dataAssinatura) : ""}
                  {t.profissional ? ` por ${t.profissional.nome}` : ""}
                </p>
              )}
              <p style={{ fontSize: 14, color: "#334155", whiteSpace: "pre-wrap", margin: "8px 0 0" }}>{t.conteudo}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
