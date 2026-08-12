import { FormEvent, useEffect, useState } from "react";
import { listarPendentesConfirmacao, PendenteConfirmacao } from "../services/dashboard";
import { confirmarAgendamento, EnvioConfirmacao } from "../services/agenda";
import {
  ConfigMensagem,
  dispararMensagens,
  EnvioMensagem,
  listarEnvios,
  listarTemplates,
  MensagemTemplate,
  obterConfigMensagem,
  PLACEHOLDERS,
  salvarConfigMensagem,
  salvarTemplate,
  TIPOS_TEMPLATE,
  TipoTemplate,
} from "../services/mensagens";
import { usePermissao } from "../context/PermissaoContext";

type Aba = "confirmacoes" | "templates" | "automatico";

export default function Mensagens() {
  const [aba, setAba] = useState<Aba>("confirmacoes");
  const { temPermissao } = usePermissao();

  return (
    <div>
      <div className="cabecalho-pagina">
        <h2>Mensagens</h2>
      </div>

      <div className="agenda-tabs">
        <button className={`agenda-tab ${aba === "confirmacoes" ? "ativo" : ""}`} onClick={() => setAba("confirmacoes")}>
          Confirmações pendentes
        </button>
        <button className={`agenda-tab ${aba === "templates" ? "ativo" : ""}`} onClick={() => setAba("templates")}>
          Modelos de mensagens
        </button>
        <button className={`agenda-tab ${aba === "automatico" ? "ativo" : ""}`} onClick={() => setAba("automatico")}>
          Envio automático
        </button>
      </div>

      {aba === "confirmacoes" && <Confirmacoes />}
      {aba === "templates" && <Templates podeConfigurar={temPermissao("mensagens.configurar") || temPermissao("config.editar")} />}
      {aba === "automatico" && <Automatico podeConfigurar={temPermissao("mensagens.configurar") || temPermissao("config.editar")} />}
    </div>
  );
}

function Automatico({ podeConfigurar }: { podeConfigurar: boolean }) {
  const [config, setConfig] = useState<ConfigMensagem | null>(null);
  const [envios, setEnvios] = useState<EnvioMensagem[]>([]);
  const [filtro, setFiltro] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [disparando, setDisparando] = useState(false);
  const [erro, setErro] = useState("");
  const [resultado, setResultado] = useState<{ lembretes: number; retornos: number; aniversarios: number; configurado: boolean } | null>(null);

  const carregar = async () => {
    setCarregando(true);
    try {
      const [c, e] = await Promise.all([obterConfigMensagem(), listarEnvios()]);
      setConfig(c);
      setEnvios(e);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregar();
  }, []);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    if (!config) return;
    setErro("");
    setSalvando(true);
    try {
      const atualizado = await salvarConfigMensagem({
        antecedenciaMin: config.antecedenciaMin,
        ativoLembrete: config.ativoLembrete,
        ativoRetorno: config.ativoRetorno,
        ativoAniversario: config.ativoAniversario,
      });
      setConfig(atualizado);
    } catch (err: any) {
      setErro(err.response?.data?.error || "Erro ao salvar configuração");
    } finally {
      setSalvando(false);
    }
  }

  async function disparar() {
    if (!confirm("Disparar envios automáticos agora (lembretes, retornos e aniversários)?")) return;
    setDisparando(true);
    setErro("");
    try {
      const r = await dispararMensagens();
      setResultado(r);
      setEnvios(await listarEnvios());
    } catch (err: any) {
      setErro(err.response?.data?.error || "Erro no disparo");
    } finally {
      setDisparando(false);
    }
  }

  if (carregando || !config) return <p>Carregando...</p>;

  const toggle = (campo: "ativoLembrete" | "ativoRetorno" | "ativoAniversario") =>
    setConfig({ ...config, [campo]: !config[campo] });

  return (
    <div>
      <div className="card section-card">
        <h3 className="mb-1">Envio automático de mensagens</h3>
        <p className="text-muted mb-1">
          O servidor verifica periodicamente e envia: <b>lembrete</b> (antes do atendimento), <b>retorno</b>
          (atrasados) e <b>aniversário</b> (pacientes aniversariantes), usando os modelos ativos da aba anterior.
          Cada envio é registrado no histórico abaixo.
        </p>

        <form onSubmit={salvar} className="form-grid">
          <div className="field">
            <label>Antecedência do lembrete</label>
            <select
              value={config.antecedenciaMin}
              onChange={(e) => setConfig({ ...config, antecedenciaMin: Number(e.target.value) })}
            >
              <option value={60}>1 hora antes</option>
              <option value={180}>3 horas antes</option>
              <option value={720}>12 horas antes</option>
              <option value={1440}>1 dia antes</option>
              <option value={2880}>2 dias antes</option>
              <option value={10080}>7 dias antes</option>
            </select>
          </div>

          <div className="form-grid">
            {[
              { campo: "ativoLembrete" as const, label: "Enviar lembretes de atendimento" },
              { campo: "ativoRetorno" as const, label: "Enviar aviso de retorno atrasado" },
              { campo: "ativoAniversario" as const, label: "Enviar mensagem de aniversário" },
            ].map((t) => (
              <label key={t.campo} className="label-inline text-small">
                <input type="checkbox" checked={config[t.campo]} onChange={() => toggle(t.campo)} />
                {t.label}
              </label>
            ))}
          </div>

          {erro && <p className="text-danger">{erro}</p>}

          <div className="flex-wrap">
            {podeConfigurar ? (
              <button className="btn btn-primary btn-sm" disabled={salvando}>
                {salvando ? "Salvando..." : "Salvar configuração"}
              </button>
            ) : (
              <p style={{ fontSize: 13, color: "#d97706" }}>Somente administradores podem alterar a configuração.</p>
            )}
            <button type="button" className="btn btn-secondary btn-sm" onClick={disparar} disabled={disparando || !podeConfigurar}>
              {disparando ? "Disparando..." : "Disparar agora"}
            </button>
          </div>
        </form>

        {resultado && (
          <div className="card card-success">
            <p className="text-small" style={{ marginBottom: 4 }}>
              <b>Disparo concluído:</b> {resultado.lembretes} lembretes, {resultado.retornos} retornos,{" "}
              {resultado.aniversarios} aniversários.
            </p>
            {!resultado.configurado && (
              <p className="text-muted">Sem WHATSAPP_API_URL configurado, os envios são registrados como <b>simulados</b>.</p>
            )}
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <h3 style={{ marginBottom: 0 }}>Histórico de envios</h3>
          <select value={filtro} onChange={(e) => { setFiltro(e.target.value); listarEnvios(e.target.value || undefined).then(setEnvios); }} className="input-compact">
            <option value="">Todos os tipos</option>
            {TIPOS_TEMPLATE.map((t) => (
              <option key={t.tipo} value={t.tipo}>{t.label}</option>
            ))}
          </select>
        </div>

        {envios.length === 0 ? (
          <div className="aviso-vazio">Nenhum envio registrado ainda.</div>
        ) : (
          <div className="historico-cards">
            {envios.map((e) => (
              <div className="card" key={e.id}>
                <div className="card-header">
                  <b>{e.paciente?.nome || "Paciente removido"}</b>
                  <span className="text-muted" style={{ fontSize: 12 }}>
                    {TIPOS_TEMPLATE.find((t) => t.tipo === e.tipo)?.label} • {new Date(e.criadoEm).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                  </span>
                </div>
                <p className="message-box">{e.texto}</p>
                <p style={{ fontSize: 12 }}>
                  {e.enviado ? (
                    <span className="text-success" style={{ fontWeight: 600 }}>
                      Enviada via {e.metodo === "whatsapp" ? "WhatsApp" : e.metodo}
                    </span>
                  ) : (
                    <span className="badge-aviso" style={{ fontWeight: 600 }}>{e.detalhe || `Não enviada (${e.metodo})`}</span>
                  )} {" "}• 📱 {e.contato}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Confirmacoes() {
  const [pendentes, setPendentes] = useState<PendenteConfirmacao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [enviandoId, setEnviandoId] = useState<string | null>(null);
  const [ultimaMensagem, setUltimaMensagem] = useState<{ contato: string; texto: string; envio?: EnvioConfirmacao } | null>(null);
  const { temPermissao } = usePermissao();

  const podeEnviar = temPermissao("agenda.atender") || temPermissao("agenda.editar");

  const carregar = async () => {
    setCarregando(true);
    try {
      setPendentes(await listarPendentesConfirmacao());
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregar();
  }, []);

  const enviarConfirmacao = async (id: string) => {
    if (!confirm("Enviar confirmação para o paciente e marcar o agendamento como confirmado?")) return;
    setEnviandoId(id);
    try {
      const resultado = await confirmarAgendamento(id);
      if (resultado.mensagemEnviada) {
        setUltimaMensagem({
          contato: resultado.contato || "contato do paciente",
          texto: resultado.mensagemEnviada,
          envio: resultado.envio,
        });
      }
      carregar();
    } catch (e: any) {
      alert(e.response?.data?.error || "Erro ao enviar confirmação");
    } finally {
      setEnviandoId(null);
    }
  };

  if (carregando) return <p>Carregando...</p>;

  return (
    <div>
      <div className="card section-card">
        <h3 className="mb-1">Confirmações pendentes</h3>
        <p className="text-muted mb-1">
          Agendamentos futuros ainda sem confirmação enviada ao paciente. As mensagens são enviadas via WhatsApp
          (quando cadastrado) ou SMS, usando o contato registrado.
        </p>

        {pendentes.length === 0 ? (
          <div className="aviso-vazio">Nenhum agendamento aguardando confirmação.</div>
        ) : (
          <div className="historico-cards">
            {pendentes.map((p) => (
              <div className="card" key={p.id}>
                <div className="card-header">
                  <b>{p.paciente.nome}</b>
                  <span className="text-muted" style={{ fontSize: 12 }}>
                    {new Date(p.dataHora).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                  </span>
                </div>
                <div className="info-grid">
                  <span>👨‍⚕️ {p.profissional.nome}{p.procedimento ? ` • ${p.procedimento.nome}` : ""}</span>
                  <span>
                    📱 {p.contato || "sem contato cadastrado"}
                    {p.possuiWhatsapp ? " (WhatsApp)" : ""}
                  </span>
                </div>
                {podeEnviar && p.contato && (
                  <div className="mt-1">
                    <button className="btn btn-primary btn-sm" onClick={() => enviarConfirmacao(p.id)} disabled={enviandoId === p.id}>
                      {enviandoId === p.id ? "Enviando..." : "Enviar confirmação"}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {ultimaMensagem && (
        <div className="card section-card">
          <h3 className="mb-1">Mensagem para {ultimaMensagem.contato}</h3>
          <p className="message-box">
            {ultimaMensagem.texto}
          </p>
          {ultimaMensagem.envio && (
            <p className="mt-1">
              {ultimaMensagem.envio.enviado ? (
                <span className="text-success" style={{ fontWeight: 600 }}>
                  Enviada via {ultimaMensagem.envio.metodo === "whatsapp" ? "WhatsApp" : ultimaMensagem.envio.metodo}
                </span>
              ) : (
                <span className="badge-aviso" style={{ fontWeight: 600 }}>
                  {ultimaMensagem.envio.atencao || `Não foi possível enviar (${ultimaMensagem.envio.metodo}).`}
                </span>
              )}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Templates({ podeConfigurar }: { podeConfigurar: boolean }) {
  const [templates, setTemplates] = useState<MensagemTemplate[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [tipoAtivo, setTipoAtivo] = useState<TipoTemplate>("confirmacao");

  const carregar = async () => {
    setCarregando(true);
    try {
      setTemplates(await listarTemplates());
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregar();
  }, []);

  const atual = templates.find((t) => t.tipo === tipoAtivo);
  const def = TIPOS_TEMPLATE.find((t) => t.tipo === tipoAtivo)!;

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setErro("");
    setSalvando(true);
    try {
      await salvarTemplate({
        tipo: tipoAtivo,
        nome: def.label,
        texto: atual?.texto || def.exemplo,
        ativo: atual?.ativo ?? true,
      });
      setTemplates(await listarTemplates());
    } catch (err: any) {
      setErro(err.response?.data?.error || "Erro ao salvar modelo");
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) return <p>Carregando...</p>;

  return (
    <div>
      <div className="card section-card">
        <h3 className="mb-1">Modelos de mensagens automáticas</h3>
        <p className="text-muted mb-1">
          Edite o texto enviado automaticamente por WhatsApp. Use os marcadores abaixo para incluir dados do
          atendimento. A confirmação de agendamento usa o modelo <b>Confirmação</b>.
        </p>

        <div className="btn-group" style={{ marginBottom: "1rem" }}>
          {TIPOS_TEMPLATE.map((t) => (
            <button
              key={t.tipo}
              type="button"
              className={`btn btn-sm ${tipoAtivo === t.tipo ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setTipoAtivo(t.tipo)}
            >
              {t.label}
              {templates.some((x) => x.tipo === t.tipo && x.ativo) ? " ✓" : ""}
            </button>
          ))}
        </div>

        <form onSubmit={salvar}>
          <div className="field">
            <label>Texto do modelo</label>
            <textarea
              rows={5}
              value={atual?.texto ?? def.exemplo}
              onChange={(e) => {
                if (atual) {
                  setTemplates((ts) => ts.map((t) => (t.tipo === tipoAtivo ? { ...t, texto: e.target.value } : t)));
                } else {
                  const novo: MensagemTemplate = {
                    id: `novo-${tipoAtivo}`,
                    tipo: tipoAtivo,
                    nome: def.label,
                    texto: e.target.value,
                    ativo: true,
                  };
                  setTemplates((ts) => [...ts.filter((t) => t.tipo !== tipoAtivo), novo]);
                }
              }}
            />
          </div>
          <div className="field">
            <label className="text-muted-small">
              Marcadores disponíveis: {PLACEHOLDERS.map((p) => <code key={p} className="code-inline">{p}</code>)}
            </label>
          </div>
          <div className="field">
            <label className="label-inline">
              <input
                type="checkbox"
                checked={atual?.ativo ?? true}
                onChange={(e) => {
                  if (atual) {
                    setTemplates((ts) => ts.map((t) => (t.tipo === tipoAtivo ? { ...t, ativo: e.target.checked } : t)));
                  }
                }}
              />
              Modelo ativo (usado nos envios automáticos)
            </label>
          </div>
          {erro && <p className="text-danger mb-1">{erro}</p>}
          {podeConfigurar ? (
            <button className="btn btn-primary btn-sm" disabled={salvando}>
              {salvando ? "Salvando..." : "Salvar modelo"}
            </button>
          ) : (
            <p style={{ fontSize: 13, color: "#d97706" }}>Somente administradores podem alterar os modelos.</p>
          )}
        </form>
      </div>
    </div>
  );
}