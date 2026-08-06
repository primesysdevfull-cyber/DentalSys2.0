import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { obterResumoDashboard, obterAvisosDashboard, ResumoDashboard, AvisosDashboard, obterResumoDia, ResumoDia } from "../services/dashboard";
import { usePermissao } from "../context/PermissaoContext";
import { formatarMoeda } from "../utils/mascaras";

export default function Dashboard() {
  const [resumo, setResumo] = useState<ResumoDashboard | null>(null);
  const [avisos, setAvisos] = useState<AvisosDashboard | null>(null);
  const [dia, setDia] = useState<ResumoDia | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const { temPermissao } = usePermissao();

  useEffect(() => {
    Promise.all([obterResumoDashboard(), obterAvisosDashboard(), obterResumoDia()])
      .then(([r, a, d]) => {
        setResumo(r);
        setAvisos(a);
        setDia(d);
      })
      .catch((e: any) => setErro(e.response?.data?.error || "Erro ao carregar o painel"))
      .finally(() => setCarregando(false));
  }, []);

  if (!temPermissao("dashboard.ver")) {
    return <div className="aviso-vazio">Seu cargo não tem permissão para visualizar o painel.</div>;
  }

  return (
    <div>
      <div className="cabecalho-pagina">
        <h2>Painel</h2>
      </div>

      {carregando ? (
        <p>Carregando...</p>
      ) : erro ? (
        <p style={{ color: "var(--cor-perigo)" }}>{erro}</p>
      ) : resumo ? (
        <>
<div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: "1.25rem" }}>
            <Link to="/agenda?novo=1" className="btn btn-accent btn-sm">+ Novo agendamento</Link>
            <Link to="/pacientes?novo=1" className="btn btn-accent btn-sm">+ Novo paciente</Link>
            {resumo.podeVerFinanceiro && (
              <Link to="/financeiro?novo=1" className="btn btn-accent btn-sm">+ Novo lançamento</Link>
            )}
          </div>

          {dia && <ResumoDoDia dia={dia} />}

          <div className="dashboard-periodo" style={{ fontSize: 13, color: "#64748b", marginBottom: 16 }}>
            Período: {new Date(resumo.periodo.inicio).toLocaleDateString("pt-BR")} a{" "}
            {new Date(resumo.periodo.fim).toLocaleDateString("pt-BR")}
          </div>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: "1.25rem" }}>
            <CardPainel titulo="Pacientes ativos" valor={String(resumo.totalPacientes)} link="/pacientes" />
            <CardPainel titulo="Pacientes novos no período" valor={String(resumo.pacientesNovos)} link="/pacientes" />
            <CardPainel
              titulo="Atendimentos realizados"
              valor={`${resumo.atendimentos.realizados} (${resumo.atendimentos.taxaComparecimento}%)`}
              link="/agenda?modo=historico"
            />
            <CardPainel titulo="Agendados próximos" valor={String(resumo.atendimentos.agendadosProximos)} link="/agenda" />
            {resumo.atendimentos.semConfirmacao > 0 && (
              <CardPainel
                titulo="Aguardando confirmação"
                valor={String(resumo.atendimentos.semConfirmacao)}
                link="/agenda"
                destaque
              />
            )}
          </div>

          {resumo.podeVerFinanceiro && (
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: "1.25rem" }}>
              <CardPainel titulo="Recebido (período)" valor={formatarMoeda(resumo.financeiro.receitas)} link="/financeiro" verde />
              <CardPainel titulo="A receber" valor={formatarMoeda(resumo.financeiro.aReceber)} link="/financeiro" amarelo />
              <CardPainel titulo="Despesas" valor={formatarMoeda(resumo.financeiro.despesas)} link="/financeiro" vermelho />
            </div>
          )}

          {avisos && <AvisosPainel avisos={avisos} />}

          <div className="card" style={{ marginBottom: "1.25rem" }}>
            <h3 style={{ marginBottom: 12 }}>Profissionais mais ativos no período</h3>
            {resumo.rankingProfissionais.length === 0 ? (
              <p style={{ fontSize: 14, color: "#64748b" }}>Nenhum atendimento no período.</p>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {resumo.rankingProfissionais.map((p, i) => {
                  const max = resumo.rankingProfissionais[0]?.atendimentos || 1;
                  const largura = Math.max(10, Math.round((p.atendimentos / max) * 100));
                  return (
                    <div key={p.nome} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <b style={{ width: 180, fontSize: 14 }}>{i + 1}. {p.nome}</b>
                      <div
                        style={{
                          flex: 1,
                          height: 14,
                          borderRadius: 6,
                          background: "var(--cor-primaria)",
                          opacity: 0.9,
                        }}
                      >
                        <div
                          style={{
                            width: `${largura}%`,
                            height: "100%",
                            borderRadius: 6,
                            background: "var(--cor-primaria)",
                          }}
                        />
                      </div>
                      <span style={{ fontSize: 13, color: "#475569", width: 40, textAlign: "right" }}>
                        {p.atendimentos}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {resumo.atendimentos.semConfirmacao > 0 && (
            <div className="card" style={{ borderLeft: "4px solid #d97706" }}>
              <h3 style={{ marginBottom: 8 }}>Confirmações pendentes</h3>
              <p style={{ fontSize: 14, color: "#475569" }}>
                {resumo.atendimentos.semConfirmacao} agendamentos futuros ainda não tiveram a confirmação enviada ao
                paciente.{" "}
                <Link to="/agenda" style={{ color: "var(--cor-primaria)" }}>
                  Ir para a agenda para enviar confirmações →
                </Link>
              </p>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}

function ResumoDoDia({ dia }: { dia: ResumoDia }) {
  const hojeLabel = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });

  const statusDia = (s: string) => {
    const labels: Record<string, string> = { agendado: "Agendado", confirmado: "Confirmado", atendido: "Atendido", faltou: "Faltou", cancelado: "Cancelado", bloqueado: "Bloqueado" };
    return labels[s] || s;
  };

  const agora = new Date();
  const agendamentosOrdenados = [...dia.agendamentos].sort((a, b) => new Date(a.dataHora).getTime() - new Date(b.dataHora).getTime());
  const proximos = agendamentosOrdenados.filter((a) => new Date(a.dataHora) >= agora && (a.status === "agendado" || a.status === "confirmado"));

  return (
    <div className="card" style={{ marginBottom: "1.25rem", borderLeft: "4px solid #1d4ed8" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        <h3 style={{ marginBottom: 0, textTransform: "capitalize" }}>📅 Hoje — {hojeLabel}</h3>
        <Link to="/agenda" className="btn btn-secondary btn-sm">Abrir agenda</Link>
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: "1rem" }}>
        <MiniCard titulo="Atendimentos do dia" valor={String(dia.atendimento.totalHoje)} cor="#1d4ed8" />
        <MiniCard titulo="Realizados" valor={String(dia.atendimento.atendidos)} cor="var(--cor-sucesso)" />
        <MiniCard titulo="Faltas" valor={String(dia.atendimento.faltas)} cor="var(--cor-perigo)" />
        <MiniCard titulo="Comparecimento" valor={`${dia.atendimento.taxaComparecimento}%`} cor="#1d4ed8" />
        {dia.proximo && (
          <MiniCard
            titulo="Próximo atendimento"
            valor={`${new Date(dia.proximo.dataHora).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} — ${dia.proximo.paciente || "Paciente"}`}
            cor="#d97706"
          />
        )}
      </div>

      {dia.podeVerFinanceiro && dia.financeiro && (
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: "1rem" }}>
          <MiniCard titulo="Recebido hoje" valor={formatarMoeda(dia.financeiro.recebidoHoje)} cor="var(--cor-sucesso)" />
          <MiniCard titulo="A receber hoje" valor={formatarMoeda(dia.financeiro.aReceberHoje)} cor="#d97706" />
          <MiniCard titulo="Despesas hoje" valor={formatarMoeda(dia.financeiro.despesasHoje)} cor="var(--cor-perigo)" />
          {dia.financeiro.fechamentoCaixa && (
            <MiniCard
              titulo={`Caixa ${dia.financeiro.fechamentoCaixa.situacao === "fechado" ? "(fechado)" : "(aberto)"}`}
              valor={formatarMoeda(dia.financeiro.fechamentoCaixa.totalGeral)}
              cor={dia.financeiro.fechamentoCaixa.situacao === "fechado" ? "#15803d" : "#d97706"}
              link="/financeiro?aba=caixa"
            />
          )}
        </div>
      )}

      <div>
        <b style={{ fontSize: 14 }}>Próximos atendimentos de hoje</b>
        {proximos.length === 0 ? (
          <p style={{ fontSize: 14, color: "#64748b", marginTop: 8 }}>
            Nenhum atendimento pendente hoje. {agendamentosOrdenados.length === 0 ? "Sem agendamentos para hoje." : ""}
          </p>
        ) : (
          <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
            {proximos.slice(0, 6).map((a) => (
              <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", fontSize: 14 }}>
                <b style={{ minWidth: 70 }}>
                  {new Date(a.dataHora).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </b>
                <Link to={`/pacientes/${a.paciente?.id}`} style={{ color: "inherit" }}>{a.paciente?.nome || "Paciente"}</Link>
                <span style={{ color: "#64748b" }}>• {a.profissional || ""}{a.procedimento ? ` • ${a.procedimento}` : ""}</span>
                <span style={{ fontSize: 12, padding: "2px 8px", borderRadius: 999, background: "#e2e8f0", color: "#334155" }}>
                  {statusDia(a.status)}{a.ehRetorno ? " • retorno" : ""}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MiniCard({ titulo, valor, cor, link }: { titulo: string; valor: string; cor: string; link?: string }) {
  const conteudo = (
    <>
      <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>{titulo}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: cor, marginTop: 4 }}>{valor}</div>
    </>
  );
  return link ? (
    <Link to={link} className="card" style={{ flex: 1, minWidth: 150, textDecoration: "none", color: "inherit" }}>{conteudo}</Link>
  ) : (
    <div className="card" style={{ flex: 1, minWidth: 150 }}>{conteudo}</div>
  );
}

function AvisosPainel({ avisos }: { avisos: AvisosDashboard }) {
  const temAlgo =
    avisos.aniversariantes.length > 0 || avisos.retornosAtrasados.length > 0 ||
    (avisos.podeVerFinanceiro && avisos.vencimentos.length > 0);

  if (!temAlgo) return null;

  return (
    <div className="card" style={{ marginBottom: "1.25rem", borderLeft: "4px solid var(--cor-laranja)" }}>
      <h3 style={{ marginBottom: 12 }}>Avisos</h3>
      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
        {avisos.aniversariantes.length > 0 && (
          <div>
            <b style={{ fontSize: 14 }}>Aniversariantes dos próximos 7 dias</b>
            <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
              {avisos.aniversariantes.map((a) => (
                <div key={a.id} style={{ fontSize: 14 }}>
                  <Link to={`/pacientes/${a.id}`} style={{ color: "inherit" }}>{a.nome}</Link>
                  <span style={{ color: "#64748b" }}>
                    {" "}— {a.diasAte === 0 ? "hoje" : `em ${a.diasAte} dia${a.diasAte === 1 ? "" : "s"}`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {avisos.retornosAtrasados.length > 0 && (
          <div>
            <b style={{ fontSize: 14 }}>Retornos atrasados</b>
            <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
              {avisos.retornosAtrasados.map((r) => (
                <div key={r.id} style={{ fontSize: 14 }}>
                  <Link to="/agenda" style={{ color: "inherit" }}>{r.paciente || "Paciente"}</Link>
                  <span style={{ color: "#b91c1c" }}>
                    {" "}— {new Date(r.dataHora).toLocaleDateString("pt-BR")}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {avisos.podeVerFinanceiro && avisos.vencimentos.length > 0 && (
          <div>
            <b style={{ fontSize: 14 }}>Vencimentos nos próximos 7 dias</b>
            <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
              {avisos.vencimentos.map((v) => (
                <div key={v.id} style={{ fontSize: 14 }}>
                  <Link to="/financeiro" style={{ color: "inherit" }}>
                    {v.descricao || v.paciente || v.profissional || "Lançamento"}
                  </Link>
                  <span style={{ color: v.diasAte < 0 ? "#b91c1c" : "#d97706" }}>
                    {" "}— {formatarMoeda(v.valor)} ({v.diasAte < 0 ? "atrasado" : v.diasAte === 0 ? "hoje" : `em ${v.diasAte} dia${v.diasAte === 1 ? "" : "s"}`})
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CardPainel({
  titulo,
  valor,
  link,
  destaque,
  verde,
  amarelo,
  vermelho,
}: {
  titulo: string;
  valor: string;
  link: string;
  destaque?: boolean;
  verde?: boolean;
  amarelo?: boolean;
  vermelho?: boolean;
}) {
  const cor = destaque ? "#d97706" : verde ? "var(--cor-sucesso)" : amarelo ? "#b45309" : vermelho ? "#b91c1c" : "var(--cor-primaria)";
  return (
    <Link to={link} className="card" style={{ flex: 1, minWidth: 180, textDecoration: "none", color: "inherit" }}>
      <div style={{ fontSize: 13, color: "#64748b", fontWeight: 600 }}>{titulo}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: cor, marginTop: 6 }}>{valor}</div>
    </Link>
  );
}