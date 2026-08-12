import { FormEvent, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Agendamento,
  bloquearHorario,
  confirmarAgendamento,
  criarAgendamento,
  excluirAgendamento,
  historicoAtendimentos,
  listarAgenda,
  marcarRetorno,
  mudarStatusAgendamento,
  obterAgendamento,
  atualizarAgendamento,
  Atendimento,
  StatusAgendamento,
} from "../services/agenda";
import { listarPacientes } from "../services/pacientes";
import { listarProfissionais, Profissional } from "../services/profissionais";
import { listarProcedimentos } from "../services/procedimentos";
import { listarSalas, Sala } from "../services/salas";
import { usePermissao } from "../context/PermissaoContext";
import Autocomplete from "../components/Autocomplete";

const HORARIO_INICIO = 8;
const HORARIO_FIM = 20;
const TOTAL_HORAS = HORARIO_FIM - HORARIO_INICIO;
const PIXELS_POR_HORA = 60;

const LABELS_STATUS: Record<StatusAgendamento, string> = {
  agendado: "Agendado",
  confirmado: "Confirmado",
  atendido: "Atendido",
  faltou: "Faltou",
  cancelado: "Cancelado",
  bloqueado: "Bloqueado",
};

function inicioDaSemana(d: Date): Date {
  const data = new Date(d);
  const dia = (data.getDay() + 6) % 7;
  data.setDate(data.getDate() - dia);
  data.setHours(0, 0, 0, 0);
  return data;
}

function mesmoDia(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatarDataHora(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function adicionarDias(d: Date, dias: number): Date {
  const nova = new Date(d);
  nova.setDate(nova.getDate() + dias);
  return nova;
}

export default function Agenda() {
  const [searchParams] = useSearchParams();
  const [visao, setVisao] = useState<"dia" | "semana" | "mes" | "historico">(
    () => (searchParams.get("modo") === "historico" ? "historico" : "dia")
  );
  const [dataRef, setDataRef] = useState(() => new Date());
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [atendimentos, setAtendimentos] = useState<Atendimento[]>([]);
  const [profissionais, setProfissionais] = useState<Profissional[]>([]);
  const [salas, setSalas] = useState<Sala[]>([]);
  const [filtroProfissional, setFiltroProfissional] = useState("");
  const [filtroSala, setFiltroSala] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);

  const [mostrarModal, setMostrarModal] = useState(false);
  const [editando, setEditando] = useState<Agendamento | null>(null);
  const [form, setForm] = useState({
    pacienteId: "",
    profissionalId: "",
    salaId: "",
    procedimentoId: "",
    data: new Date().toISOString().slice(0, 10),
    hora: "09:00",
    duracaoMin: "30",
    observacoes: "",
  });

  const [modalBloqueio, setModalBloqueio] = useState(false);
  const [formBloqueio, setFormBloqueio] = useState({ profissionalId: "", salaId: "", data: "", hora: "12:00", duracaoMin: "60", observacoes: "" });

  const [modalRetorno, setModalRetorno] = useState(false);
  const [formRetorno, setFormRetorno] = useState({ data: "", hora: "09:00", duracaoMin: "30", observacoes: "" });

  const [detalhe, setDetalhe] = useState<Agendamento | null>(null);
  const [modalDetalhe, setModalDetalhe] = useState(false);

  const [filtroHistorico, setFiltroHistorico] = useState("");

  const { temPermissao } = usePermissao();
  const podeCriar = temPermissao("agenda.criar");
  const podeEditar = temPermissao("agenda.editar");
  const podeAtender = temPermissao("agenda.atender");
  const podeExcluir = temPermissao("agenda.excluir");
  const podeGerenciarSalas = temPermissao("salas.gerenciar");

  const [novaSala, setNovaSala] = useState("");

  const [periodo, setPeriodo] = useState<{ inicio: Date; fim: Date }>(() => {
    const hoje = new Date();
    return { inicio: hoje, fim: hoje };
  });

  useEffect(() => {
    let inicio: Date;
    let fim: Date;
    if (visao === "dia") {
      inicio = new Date(dataRef);
      inicio.setHours(0, 0, 0, 0);
      fim = new Date(inicio);
      fim.setDate(fim.getDate() + 1);
      fim.setMilliseconds(-1);
    } else if (visao === "semana") {
      inicio = inicioDaSemana(dataRef);
      fim = adicionarDias(inicio, 7);
      fim.setMilliseconds(-1);
    } else if (visao === "mes") {
      inicio = new Date(dataRef.getFullYear(), dataRef.getMonth(), 1);
      fim = new Date(dataRef.getFullYear(), dataRef.getMonth() + 1, 0, 23, 59, 59, 999);
    } else {
      inicio = new Date(0);
      fim = new Date(8640000000000000);
    }
    setPeriodo({ inicio, fim });
  }, [visao, dataRef]);

  const carregarDados = async () => {
    try {
      const [profs, salasLista] = await Promise.all([
        listarProfissionais(),
        listarSalas(),
      ]);
      setProfissionais(profs);
      setSalas(salasLista);
    } catch (e: any) {
      setErro(e.response?.data?.error || "Erro ao carregar dados de apoio");
    }
  };

  const carregarAgenda = async () => {
    try {
      setCarregando(true);
      const [ag, hist] = await Promise.all([
        listarAgenda({
          inicio: periodo.inicio.toISOString(),
          fim: periodo.fim.toISOString(),
          profissionalId: filtroProfissional || undefined,
          salaId: filtroSala || undefined,
        }),
        visao === "historico" ? historicoAtendimentos() : Promise.resolve([]),
      ]);
      setAgendamentos(ag);
      setAtendimentos(hist);
    } catch (e: any) {
      setErro(e.response?.data?.error || "Erro ao carregar agenda");
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, []);

  useEffect(() => {
    carregarAgenda();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodo, filtroProfissional, filtroSala, visao]);

  const navegar = (dias: number) => {
    const nova = new Date(dataRef);
    if (visao === "dia") nova.setDate(nova.getDate() + dias);
    else if (visao === "semana") nova.setDate(nova.getDate() + dias * 7);
    else nova.setMonth(nova.getMonth() + dias);
    setDataRef(nova);
  };

  const irParaHoje = () => setDataRef(new Date());

  const tituloPeriodo = useMemo(() => {
    if (visao === "dia") return dataRef.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
    if (visao === "semana") {
      const inicio = inicioDaSemana(dataRef);
      const fim = adicionarDias(inicio, 6);
      return `${inicio.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} – ${fim.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}`;
    }
    return dataRef.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  }, [visao, dataRef]);

  function abrirNovo(dia?: Date) {
    setEditando(null);
    setForm({
      pacienteId: "",
      profissionalId: filtroProfissional,
      salaId: "",
      procedimentoId: "",
      data: (dia || dataRef).toISOString().slice(0, 10),
      hora: "09:00",
      duracaoMin: "30",
      observacoes: "",
    });
    setMostrarModal(true);
  }

  useEffect(() => {
    if (searchParams.get("novo") === "1") abrirNovo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setErro("");
    try {
      const dataHora = new Date(`${form.data}T${form.hora}:00`);
      const payload = {
        pacienteId: form.pacienteId || null,
        profissionalId: form.profissionalId,
        salaId: form.salaId || null,
        procedimentoId: form.procedimentoId || null,
        dataHora: dataHora.toISOString(),
        duracaoMin: Number(form.duracaoMin),
        observacoes: form.observacoes || null,
      };
      if (editando) {
        await atualizarAgendamento(editando.id, payload);
      } else {
        await criarAgendamento(payload);
      }
      setMostrarModal(false);
      carregarAgenda();
    } catch (err: any) {
      setErro(err.response?.data?.error || "Erro ao salvar agendamento");
    }
  }

  async function salvarBloqueio(e: FormEvent) {
    e.preventDefault();
    setErro("");
    try {
      await bloquearHorario({
        profissionalId: formBloqueio.profissionalId,
        salaId: formBloqueio.salaId || null,
        dataHora: new Date(`${formBloqueio.data}T${formBloqueio.hora}:00`).toISOString(),
        duracaoMin: Number(formBloqueio.duracaoMin),
        observacoes: formBloqueio.observacoes || "Horário bloqueado",
      });
      setModalBloqueio(false);
      setFormBloqueio({ profissionalId: "", salaId: "", data: dataRef.toISOString().slice(0, 10), hora: "12:00", duracaoMin: "60", observacoes: "" });
      carregarAgenda();
    } catch (err: any) {
      setErro(err.response?.data?.error || "Erro ao bloquear horário");
    }
  }

  async function salvarRetorno(e: FormEvent) {
    e.preventDefault();
    setErro("");
    if (!detalhe) return;
    try {
      await marcarRetorno(detalhe.id, {
        dataHora: new Date(`${formRetorno.data}T${formRetorno.hora}:00`).toISOString(),
        duracaoMin: Number(formRetorno.duracaoMin),
        observacoes: formRetorno.observacoes || null,
      });
      setModalRetorno(false);
      carregarAgenda();
    } catch (err: any) {
      setErro(err.response?.data?.error || "Erro ao marcar retorno");
    }
  }

  async function mudarStatus(id: string, status: StatusAgendamento) {
    setErro("");
    try {
      await mudarStatusAgendamento(id, status);
      carregarAgenda();
      if (modalDetalhe) {
        setDetalhe(await obterAgendamento(id));
      }
    } catch (err: any) {
      setErro(err.response?.data?.error || "Erro ao atualizar status");
    }
  }

  async function enviarConfirmacao(id: string) {
    setErro("");
    try {
      const resultado = await confirmarAgendamento(id);
      carregarAgenda();
      if (modalDetalhe) {
        setDetalhe(await obterAgendamento(id));
      }
      alert(`Confirmação enviada para ${resultado.contato || "contato do paciente"}.\n\n${resultado.mensagemEnviada}`);
    } catch (err: any) {
      setErro(err.response?.data?.error || "Erro ao enviar confirmação");
    }
  }

  async function removerAgendamento(id: string) {
    if (!confirm("Excluir este agendamento?")) return;
    setErro("");
    try {
      await excluirAgendamento(id);
      setModalDetalhe(false);
      setDetalhe(null);
      carregarAgenda();
    } catch (err: any) {
      setErro(err.response?.data?.error || "Erro ao excluir agendamento");
    }
  }

  async function abrirDetalhe(id: string) {
    setErro("");
    try {
      const ag = await obterAgendamento(id);
      setDetalhe(ag);
      setModalDetalhe(true);
    } catch (err: any) {
      setErro(err.response?.data?.error || "Erro ao abrir agendamento");
    }
  }

  async function editarDetalhe() {
    if (!detalhe) return;
    setEditando(detalhe);
    setForm({
      pacienteId: detalhe.pacienteId || "",
      profissionalId: detalhe.profissionalId,
      salaId: detalhe.salaId || "",
      procedimentoId: detalhe.procedimentoId || "",
      data: new Date(detalhe.dataHora).toISOString().slice(0, 10),
      hora: new Date(detalhe.dataHora).toTimeString().slice(0, 5),
      duracaoMin: String(detalhe.duracaoMin),
      observacoes: detalhe.observacoes || "",
    });
    setModalDetalhe(false);
    setMostrarModal(true);
  }

  async function adicionarSala(e: FormEvent) {
    e.preventDefault();
    setErro("");
    try {
      const { criarSala } = await import("../services/salas");
      await criarSala({ nome: novaSala });
      setNovaSala("");
      carregarDados();
    } catch (err: any) {
      setErro(err.response?.data?.error || "Erro ao criar sala");
    }
  }

  async function removerSala(id: string) {
    if (!confirm("Excluir esta sala?")) return;
    setErro("");
    try {
      const { excluirSala } = await import("../services/salas");
      await excluirSala(id);
      carregarDados();
    } catch (err: any) {
      setErro(err.response?.data?.error || "Erro ao excluir sala");
    }
  }

  const corStatus: Record<StatusAgendamento, string> = {
    agendado: "#64748b",
    confirmado: "#2563eb",
    atendido: "#16a34a",
    faltou: "#ea580c",
    cancelado: "#ef4444",
    bloqueado: "#334155",
  };

  const diasDaSemana = useMemo(() => {
    const inicio = inicioDaSemana(dataRef);
    return Array.from({ length: 7 }, (_, i) => adicionarDias(inicio, i));
  }, [dataRef]);

  const agendamentosDoDia = (dia: Date) =>
    agendamentos.filter((a) => mesmoDia(new Date(a.dataHora), dia));

  const diasDoMes = useMemo(() => {
    const primeiro = new Date(dataRef.getFullYear(), dataRef.getMonth(), 1);
    const diaInicial = (primeiro.getDay() + 6) % 7;
    const celulas: Date[] = [];
    const inicioGrid = adicionarDias(primeiro, -diaInicial);
    for (let i = 0; i < 42; i++) {
      celulas.push(adicionarDias(inicioGrid, i));
    }
    return celulas;
  }, [dataRef]);

  const pacientesFiltrados = atendimentos.filter(
    (a) =>
      !filtroHistorico ||
      (a.paciente?.nome || "").toLowerCase().includes(filtroHistorico.toLowerCase())
  );

  if (visao === "historico") {
    return (
      <div>
        <div className="cabecalho-pagina">
          <h2>Histórico de Atendimentos</h2>
          <div className="agenda-tabs">
            {(["dia", "semana", "mes", "historico"] as const).map((v) => (
              <button key={v} className={`agenda-tab ${visao === v ? "ativo" : ""}`} onClick={() => setVisao(v)}>
                {v === "dia" ? "Dia" : v === "semana" ? "Semana" : v === "mes" ? "Mês" : "Histórico"}
              </button>
            ))}
          </div>
        </div>

        {erro && <p className="text-danger mb-1">{erro}</p>}

        <input
          className="busca"
          placeholder="Filtrar histórico por paciente..."
          value={filtroHistorico}
          onChange={(e) => setFiltroHistorico(e.target.value)}
        />

        {carregando ? (
          <p>Carregando...</p>
        ) : pacientesFiltrados.length === 0 ? (
          <div className="aviso-vazio">Nenhum atendimento registrado.</div>
        ) : (
          <div className="historico-cards">
            {pacientesFiltrados.map((a) => (
              <div className="card" key={a.id}>
                        <div className="card-header">
                          <b>{a.paciente?.nome || "—"}</b>
                          <span className={a.status === "atendido" ? "status-ativo" : "agenda-status-faltou"}>
                            {a.status === "atendido" ? "Atendido" : "Faltou"}
                          </span>
                        </div>
                        <div className="info-grid text-muted">
                  <span>📅 {formatarDataHora(a.dataHora)}</span>
                  <span>👨‍⚕️ {a.profissional?.nome}</span>
                  {a.procedimento && <span>🦷 {a.procedimento.nome}</span>}
                  {a.sala && <span>🚪 {a.sala.nome}</span>}
                  {a.observacoes && <span>📝 {a.observacoes}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="cabecalho-pagina">
        <h2>Agenda</h2>
        {podeCriar && (
          <button className="btn-novo" onClick={() => abrirNovo()}>
            + Novo agendamento
          </button>
        )}
      </div>

      {erro && <p style={{ color: "var(--cor-perigo)", marginBottom: 12 }}>{erro}</p>}

      <div className="agenda-ferramentas">
        <div className="agenda-tabs">
          {(["dia", "semana", "mes", "historico"] as const).map((v) => (
            <button key={v} className={`agenda-tab ${visao === v ? "ativo" : ""}`} onClick={() => setVisao(v)}>
              {v === "dia" ? "Dia" : v === "semana" ? "Semana" : v === "mes" ? "Mês" : "Histórico"}
            </button>
          ))}
        </div>

        <div className="agenda-nav">
          <button onClick={() => navegar(-1)}>‹</button>
          <button onClick={irParaHoje}>Hoje</button>
          <button onClick={() => navegar(1)}>›</button>
          <span className="agenda-data-titulo">{tituloPeriodo}</span>
        </div>

        <div className="toolbar" style={{ marginLeft: "auto" }}>
          <select className="input-compact" value={filtroSala} onChange={(e) => setFiltroSala(e.target.value)}>
            <option value="">Todas as salas</option>
            {salas.map((s) => (
              <option key={s.id} value={s.id}>{s.nome}</option>
            ))}
          </select>
          <select className="input-compact" value={filtroProfissional} onChange={(e) => setFiltroProfissional(e.target.value)}>
            <option value="">Todos os profissionais</option>
            {profissionais.map((p) => (
              <option key={p.id} value={p.id}>{p.nome}</option>
            ))}
          </select>
        </div>
        
      </div>

      {podeEditar && (
        <div className="card toolbar">
          <button className="btn btn-secondary btn-sm" onClick={() => {
            setFormBloqueio({ profissionalId: filtroProfissional, salaId: "", data: dataRef.toISOString().slice(0, 10), hora: "12:00", duracaoMin: "60", observacoes: "" });
            setModalBloqueio(true);
          }}>
            🔒 Bloquear horário
          </button>
          {podeGerenciarSalas && (
            <form onSubmit={adicionarSala} className="form-inline">
              <input placeholder="Nova sala..." value={novaSala} onChange={(e) => setNovaSala(e.target.value)} className="input-compact" />
              <button className="btn btn-secondary btn-sm">+ Sala</button>
            </form>
          )}
          {podeGerenciarSalas && salas.map((s) => (
            <span key={s.id} className="chip">
              {s.nome}
              <button type="button" onClick={() => removerSala(s.id)} className="chip-remove">×</button>
            </span>
          ))}
        </div>
      )}

      {carregando ? (
        <p>Carregando...</p>
      ) : visao === "mes" ? (
        <div className="agenda-mes-grade">
          {[
            "Seg",
            "Ter",
            "Qua",
            "Qui",
            "Sex",
            "Sáb",
            "Dom",
          ].map((d) => (
            <div key={d} className="mes-header-cell">{d}</div>
          ))}
          {diasDoMes.map((dia, i) => {
            const foraDoMes = dia.getMonth() !== dataRef.getMonth();
            const eventos = agendamentosDoDia(dia);
            return (
              <div key={i} className={`agenda-mes-dia ${foraDoMes ? "outro-mes" : ""} ${mesmoDia(dia, new Date()) ? "hoje" : ""}`}>
                <span className="dia-num">{dia.getDate()}</span>
                {eventos.slice(0, 4).map((a) => (
                  <span
                    key={a.id}
                    className={`agenda-mes-evento ${a.status}`}
                    style={{ background: corStatus[a.status] }}
                    onClick={() => abrirDetalhe(a.id)}
                  >
                    {new Date(a.dataHora).toTimeString().slice(0, 5)} {a.paciente?.nome || "Bloqueio"}
                  </span>
                ))}
                {eventos.length > 4 && <div className="text-muted small mt-1">+{eventos.length - 4} mais</div>}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="agenda-grade">
          <div className="agenda-horarios">
            <div className="agenda-colunas-horas">
              {Array.from({ length: TOTAL_HORAS }, (_, i) => (
                <div key={i} className="agenda-hora-cell">
                  {String(HORARIO_INICIO + i).padStart(2, "0")}:00
                </div>
              ))}
            </div>
            <div className="agenda-dias">
              {visao === "dia"
                ? [dataRef].map((dia) => <ColunaDia key={dia.toISOString()} dia={dia} agendamentos={agendamentosDoDia(dia)} onAbrir={abrirDetalhe} onNovo={() => abrirNovo(dia)} podeCriar={podeCriar} />)
                : diasDaSemana.map((dia) => <ColunaDia key={dia.toISOString()} dia={dia} agendamentos={agendamentosDoDia(dia)} onAbrir={abrirDetalhe} onNovo={() => abrirNovo(dia)} podeCriar={podeCriar} />)}
            </div>
          </div>
        </div>
      )}

      <div className="agenda-legenda">
        {Object.entries(LABELS_STATUS).map(([k, v]) => (
          <span key={k}>
            <span className="dot" style={{ background: corStatus[k as StatusAgendamento] }} /> {v}
          </span>
        ))}
        <span>
          <span className="dot" style={{ background: "#e2e8f0", border: "2px solid #2563eb" }} /> Clique em um horário para agendar
        </span>
      </div>

      {mostrarModal && (
        <Modal titulo={editando ? "Editar agendamento" : "Novo agendamento"} onFechar={() => setMostrarModal(false)}>
          <form onSubmit={salvar}>
            <div className="grid-2">
              <div className="field">
                <label>Paciente *</label>
                <Autocomplete
                  obrigatorio
                  valor={form.pacienteId}
                  rotuloInicial={editando?.paciente?.nome}
                  onChange={(id) => setForm({ ...form, pacienteId: id || "" })}
                  placeholder="Buscar paciente por nome, CPF..."
                  todasOpcoes={async () => {
                    const res = await listarPacientes();
                    return res.map((p) => ({ id: p.id, label: p.nome, sub: p.cpf || p.telefone || "" }));
                  }}
                  buscar={async (termo) => {
                    const res = await listarPacientes(termo);
                    return res.map((p) => ({ id: p.id, label: p.nome, sub: p.cpf || p.telefone || "" }));
                  }}
                />
              </div>
              <div className="field">
                <label>Profissional *</label>
                <Autocomplete
                  obrigatorio
                  valor={form.profissionalId}
                  rotuloInicial={editando?.profissional?.nome}
                  onChange={(id) => setForm({ ...form, profissionalId: id || "" })}
                  placeholder="Buscar profissional..."
                  todasOpcoes={async () => {
                    const res = await listarProfissionais();
                    return res.map((p) => ({ id: p.id, label: p.nome, sub: p.especialidade || p.cro }));
                  }}
                  buscar={async (termo) => {
                    const res = await listarProfissionais(termo);
                    return res.map((p) => ({ id: p.id, label: p.nome, sub: p.especialidade || p.cro }));
                  }}
                />
              </div>
              <div className="field">
                <label>Sala</label>
                <select value={form.salaId} onChange={(e) => setForm({ ...form, salaId: e.target.value })}>
                  <option value="">Sem sala</option>
                  {salas.map((s) => (
                    <option key={s.id} value={s.id}>{s.nome}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Procedimento</label>
                <Autocomplete
                  valor={form.procedimentoId}
                  rotuloInicial={editando?.procedimento?.nome}
                  onChange={(id) => setForm({ ...form, procedimentoId: id || "" })}
                  placeholder="Buscar procedimento..."
                  buscar={async (termo) => {
                    const res = await listarProcedimentos(termo);
                    return res.map((p) => ({ id: p.id, label: p.nome, sub: p.codigoTuss ? `TUSS ${p.codigoTuss}` : "" }));
                  }}
                />
              </div>
              <div className="field">
                <label>Data *</label>
                <input required type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} />
              </div>
              <div className="field">
                <label>Hora *</label>
                <input required type="time" value={form.hora} onChange={(e) => setForm({ ...form, hora: e.target.value })} />
              </div>
              <div className="field">
                <label>Duração (min)</label>
                <input type="number" min={5} step={5} value={form.duracaoMin} onChange={(e) => setForm({ ...form, duracaoMin: e.target.value })} />
              </div>
            </div>
            <div className="field">
              <label>Observações</label>
              <textarea rows={2} value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
            </div>
            <button className="btn btn-primary">{editando ? "Salvar alterações" : "Agendar"}</button>
          </form>
        </Modal>
      )}

      {modalBloqueio && (
        <Modal titulo="Bloquear horário" onFechar={() => setModalBloqueio(false)}>
          <form onSubmit={salvarBloqueio}>
            <div className="grid-2">
              <div className="field">
                <label>Profissional *</label>
                <select required value={formBloqueio.profissionalId} onChange={(e) => setFormBloqueio({ ...formBloqueio, profissionalId: e.target.value })}>
                  <option value="">Selecione...</option>
                  {profissionais.map((p) => (
                    <option key={p.id} value={p.id}>{p.nome}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Sala</label>
                <select value={formBloqueio.salaId} onChange={(e) => setFormBloqueio({ ...formBloqueio, salaId: e.target.value })}>
                  <option value="">Sem sala</option>
                  {salas.map((s) => (
                    <option key={s.id} value={s.id}>{s.nome}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Data *</label>
                <input required type="date" value={formBloqueio.data} onChange={(e) => setFormBloqueio({ ...formBloqueio, data: e.target.value })} />
              </div>
              <div className="field">
                <label>Hora *</label>
                <input required type="time" value={formBloqueio.hora} onChange={(e) => setFormBloqueio({ ...formBloqueio, hora: e.target.value })} />
              </div>
              <div className="field">
                <label>Duração (min)</label>
                <input type="number" min={5} step={5} value={formBloqueio.duracaoMin} onChange={(e) => setFormBloqueio({ ...formBloqueio, duracaoMin: e.target.value })} />
              </div>
            </div>
            <div className="field">
              <label>Motivo</label>
              <input value={formBloqueio.observacoes} onChange={(e) => setFormBloqueio({ ...formBloqueio, observacoes: e.target.value })} />
            </div>
            <button className="btn btn-primary">Bloquear</button>
          </form>
        </Modal>
      )}

      {modalRetorno && detalhe && (
        <Modal titulo={`Marcar retorno de ${detalhe.paciente?.nome || "paciente"}`} onFechar={() => setModalRetorno(false)}>
          <form onSubmit={salvarRetorno}>
            <div className="grid-2">
              <div className="field">
                <label>Data do retorno *</label>
                <input required type="date" value={formRetorno.data} onChange={(e) => setFormRetorno({ ...formRetorno, data: e.target.value })} />
              </div>
              <div className="field">
                <label>Hora *</label>
                <input required type="time" value={formRetorno.hora} onChange={(e) => setFormRetorno({ ...formRetorno, hora: e.target.value })} />
              </div>
              <div className="field">
                <label>Duração (min)</label>
                <input type="number" min={5} step={5} value={formRetorno.duracaoMin} onChange={(e) => setFormRetorno({ ...formRetorno, duracaoMin: e.target.value })} />
              </div>
            </div>
            <div className="field">
              <label>Observações</label>
              <textarea rows={2} value={formRetorno.observacoes} onChange={(e) => setFormRetorno({ ...formRetorno, observacoes: e.target.value })} />
            </div>
            <button className="btn btn-primary">Marcar retorno</button>
          </form>
        </Modal>
      )}

      {modalDetalhe && detalhe && (
        <Modal titulo="Detalhes do agendamento" onFechar={() => setModalDetalhe(false)}>
          <div style={{ display: "grid", gap: 6, fontSize: 14, marginBottom: "1rem" }}>
            <div><b>Paciente:</b> {detalhe.paciente?.nome || "—"}</div>
            <div><b>Profissional:</b> {detalhe.profissional?.nome}</div>
            <div><b>Data/Hora:</b> {formatarDataHora(detalhe.dataHora)}</div>
            <div><b>Duração:</b> {detalhe.duracaoMin} min</div>
            <div><b>Procedimento:</b> {detalhe.procedimento?.nome || "—"}</div>
            <div><b>Sala:</b> {detalhe.sala?.nome || "—"}</div>
            <div><b>Status:</b> <span className={`agenda-status-${detalhe.status}`}>{LABELS_STATUS[detalhe.status]}</span></div>
            {detalhe.ehRetorno && <div><b>↩</b> Este é um retorno</div>}
            {detalhe.observacoes && <div><b>Obs.:</b> {detalhe.observacoes}</div>}
          </div>

          <div className="modal-acoes-status">
            {podeAtender && detalhe.status === "agendado" && (
              <button className="btn btn-primary btn-sm" onClick={() => mudarStatus(detalhe.id, "confirmado")}>Confirmar</button>
            )}
            {podeEditar && detalhe.status !== "cancelado" && detalhe.status !== "atendido" && (
              <button className="btn btn-secondary btn-sm" onClick={() => enviarConfirmacao(detalhe.id)}>Enviar confirmação</button>
            )}
            {podeAtender && detalhe.status === "confirmado" && (
              <>
                <button className="btn btn-primary btn-sm" style={{ background: "#16a34a" }} onClick={() => mudarStatus(detalhe.id, "atendido")}>Atender</button>
                <button className="btn btn-secondary btn-sm" style={{ background: "#ea580c", color: "white" }} onClick={() => mudarStatus(detalhe.id, "faltou")}>Faltou</button>
              </>
            )}
            {podeAtender && detalhe.status === "faltou" && (
              <button className="btn btn-secondary btn-sm" onClick={() => mudarStatus(detalhe.id, "agendado")}>Reagendar</button>
            )}
            {(detalhe.status === "agendado" || detalhe.status === "confirmado") && podeAtender && (
              <button className="btn btn-secondary btn-sm" style={{ background: "#ef4444", color: "white" }} onClick={() => mudarStatus(detalhe.id, "cancelado")}>Cancelar</button>
            )}
            {detalhe.status === "atendido" && podeCriar && (
              <button className="btn btn-secondary btn-sm" onClick={() => {
                setFormRetorno({ data: new Date().toISOString().slice(0, 10), hora: "09:00", duracaoMin: String(detalhe.duracaoMin), observacoes: "" });
                setModalRetorno(true);
              }}>↩ Marcar retorno</button>
            )}
            {podeEditar && (
              <button className="btn btn-secondary btn-sm" onClick={editarDetalhe}>Reagendar / Editar</button>
            )}
            {podeExcluir && (
              <button className="btn btn-danger btn-sm" onClick={() => removerAgendamento(detalhe.id)}>Excluir</button>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}

function Modal({ titulo, children, onFechar }: { titulo: string; children: React.ReactNode; onFechar: () => void }) {
  return (
    <div className="modal-overlay" onClick={onFechar}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-titulo">
          <h3>{titulo}</h3>
          <button className="modal-fechar" onClick={onFechar}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ColunaDia({ dia, agendamentos, onAbrir, onNovo, podeCriar }: {
  dia: Date;
  agendamentos: Agendamento[];
  onAbrir: (id: string) => void;
  onNovo: () => void;
  podeCriar: boolean;
}) {
  const hoje = mesmoDia(dia, new Date());
  const inicio = new Date(dia);
  inicio.setHours(HORARIO_INICIO, 0, 0, 0);

  const ordem: Record<StatusAgendamento, number> = {
    bloqueado: 0,
    confirmado: 1,
    agendado: 2,
    atendido: 3,
    faltou: 4,
    cancelado: 5,
  };

  return (
    <div className="agenda-dia-coluna">
      <div className={`agenda-dia-cabecalho ${hoje ? "hoje" : ""}`}>
        {dia.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "")} {dia.getDate()}
      </div>
      <div className="agenda-blocos">
        {Array.from({ length: TOTAL_HORAS }, (_, i) => (
          <div
            key={i}
            onClick={podeCriar ? onNovo : undefined}
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: i * PIXELS_POR_HORA,
              height: PIXELS_POR_HORA,
              borderTop: i > 0 ? "1px solid #f1f5f9" : undefined,
              cursor: podeCriar ? "pointer" : undefined,
            }}
          />
        ))}
        {[...agendamentos]
          .sort((a, b) => ordem[a.status] - ordem[b.status])
          .map((a) => {
            const data = new Date(a.dataHora);
            const offsetMin = (data.getHours() * 60 + data.getMinutes()) - HORARIO_INICIO * 60;
            const top = Math.max(0, offsetMin);
            const altura = Math.max(20, (a.duracaoMin / 60) * PIXELS_POR_HORA);
            return (
              <div
                key={a.id}
                className="agenda-bloco"
                style={{
                  top,
                  height: altura,
                  background: corBloco(a.status),
                  borderLeftColor: corBloco(a.status),
                }}
                onClick={() => onAbrir(a.id)}
              >
                <b>{a.paciente?.nome || "Bloqueio"}</b>
                <span className="ag-bloco-tempo">
                  {data.toTimeString().slice(0, 5)} · {a.duracaoMin}min
                </span>
                {a.procedimento && <span className="ag-bloco-tempo">{a.procedimento.nome}</span>}
                {a.ehRetorno && <span className="ag-bloco-tempo">↩ Retorno</span>}
              </div>
            );
          })}
      </div>
    </div>
  );
}

function corBloco(status: StatusAgendamento): string {
  const cores: Record<StatusAgendamento, string> = {
    agendado: "#64748b",
    confirmado: "#2563eb",
    atendido: "#16a34a",
    faltou: "#ea580c",
    cancelado: "#ef4444",
    bloqueado: "#334155",
  };
  return cores[status];
}
