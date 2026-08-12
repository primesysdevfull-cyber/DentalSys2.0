import { useEffect, useState } from "react";
import {
  Lancamento,
  listarLancamentos,
} from "../services/financeiro";
import { listarPacientes, Paciente } from "../services/pacientes";
import { obterRelatorioAgenda, obterRelatorioCompleto, RelatorioAgenda, RelatorioCompleto } from "../services/dashboard";
import { usePermissao } from "../context/PermissaoContext";
import { formatarMoeda } from "../utils/mascaras";
import { baixarCsv } from "../utils/csv";

type Aba = "agenda" | "pacientes" | "financeiro" | "analises";

const FORMASPAG: Record<string, string> = {
  dinheiro: "Dinheiro",
  pix: "Pix",
  cartao_credito: "Cartão de crédito",
  cartao_debito: "Cartão de débito",
  convenio: "Convênio",
  transferencia: "Transferência",
};

export default function Relatorios() {
  const [aba, setAba] = useState<Aba>("agenda");
  const { temPermissao } = usePermissao();
  const podeVerFinanceiro = temPermissao("financeiro.ver");

  return (
    <div>
      <div className="cabecalho-pagina">
        <h2>Relatórios</h2>
      </div>

      <div className="agenda-tabs">
        <button className={`agenda-tab ${aba === "agenda" ? "ativo" : ""}`} onClick={() => setAba("agenda")}>
          Atendimentos
        </button>
        <button className={`agenda-tab ${aba === "pacientes" ? "ativo" : ""}`} onClick={() => setAba("pacientes")}>
          Pacientes
        </button>
        {podeVerFinanceiro && (
          <button className={`agenda-tab ${aba === "financeiro" ? "ativo" : ""}`} onClick={() => setAba("financeiro")}>
            Financeiro
          </button>
        )}
        <button className={`agenda-tab ${aba === "analises" ? "ativo" : ""}`} onClick={() => setAba("analises")}>
          Análises
        </button>
      </div>

      {aba === "agenda" && <RelatorioAgendaTab />}
      {aba === "pacientes" && <RelatorioPacientesTab />}
      {aba === "financeiro" && podeVerFinanceiro && <RelatorioFinanceiroTab />}
      {aba === "analises" && <RelatorioAnalisesTab />}
    </div>
  );
}

function usePeriodo() {
  const primeiroDia = new Date();
  primeiroDia.setDate(1);
  const hoje = new Date();
  const [inicio, setInicio] = useState(primeiroDia.toISOString().slice(0, 10));
  const [fim, setFim] = useState(hoje.toISOString().slice(0, 10));
  return { inicio, fim, setInicio, setFim };
}

function PeriodoFiltro({ inicio, fim, setInicio, setFim }: {
  inicio: string;
  fim: string;
  setInicio: (v: string) => void;
  setFim: (v: string) => void;
}) {
  return (
    <div className="toolbar flex-wrap mt-1">
      <div className="field">
        <label>De</label>
        <input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} className="input-compact" />
      </div>
      <div className="field">
        <label>Até</label>
        <input type="date" value={fim} onChange={(e) => setFim(e.target.value)} className="input-compact" />
      </div>
    </div>
  );
}

function imprimirRelatorio(titulo: string, cabecalho: string[], linhas: (string | number | null | undefined)[][]) {
  const janela = window.open("", "_blank", "width=900,height=700");
  if (!janela) return;
  const ths = cabecalho.map((c) => `<th>${c}</th>`).join("");
  const tds = linhas
    .map(
      (linha) =>
        `<tr>${linha.map((v) => `<td>${v === null || v === undefined ? "" : String(v).replace(/</g, "&lt;")}</td>`).join("")}</tr>`
    )
    .join("");
  janela.document.write(`
    <html><head><title>${titulo}</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 32px; color: #111; }
      h1 { font-size: 18px; letter-spacing: 1px; border-bottom: 2px solid #000; padding-bottom: 8px; }
      .meta { font-size: 12px; color: #555; margin-bottom: 16px; }
      table { border-collapse: collapse; width: 100%; font-size: 12px; }
      th { background: #f1f5f9; border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; }
      td { border: 1px solid #cbd5e1; padding: 6px 8px; }
      .vazio { color: #888; margin-top: 16px; }
    </style></head>
    <body>
      <h1>${titulo}</h1>
      <div class="meta">Emitido em ${new Date().toLocaleString("pt-BR")}</div>
      ${linhas.length ? `<table><thead><tr>${ths}</tr></thead><tbody>${tds}</tbody></table>` : `<p class="vazio">Nenhum registro.</p>`}
    </body></html>`);
  janela.document.close();
  janela.focus();
  setTimeout(() => janela.print(), 300);
}

function RelatorioAgendaTab() {
  const { inicio, fim, setInicio, setFim } = usePeriodo();
  const [dados, setDados] = useState<RelatorioAgenda | null>(null);
  const [carregando, setCarregando] = useState(true);

  const carregar = async () => {
    setCarregando(true);
    try {
      setDados(await obterRelatorioAgenda(inicio ? new Date(`${inicio}T00:00:00`).toISOString() : undefined, fim ? new Date(`${fim}T23:59:59`).toISOString() : undefined));
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inicio, fim]);

  const exportar = () => {
    if (!dados) return;
    baixarCsv("relatorio-atendimentos", ["Data", "Status", "Paciente", "Profissional", "Procedimento", "Sala", "Observações"], dados.agendamentos.map((a) => [
      new Date(a.dataHora).toLocaleString("pt-BR"),
      a.status,
      a.paciente,
      a.profissional,
      a.procedimento,
      a.sala,
      a.observacoes,
    ]));
  };

  return (
    <div>
      <PeriodoFiltro inicio={inicio} fim={fim} setInicio={setInicio} setFim={setFim} />
      <div className="toolbar" style={{ gap: 8 }}>
        <button className="btn btn-primary btn-sm" onClick={exportar} disabled={!dados}>Exportar CSV</button>
        <button className="btn btn-secondary btn-sm" onClick={() => {
        if (!dados) return;
        imprimirRelatorio("Relatório de Atendimentos", ["Data", "Status", "Paciente", "Profissional", "Procedimento", "Sala", "Observações"], dados.agendamentos.map((a) => [
          new Date(a.dataHora).toLocaleString("pt-BR"),
          a.status,
          a.paciente,
          a.profissional,
          a.procedimento,
          a.sala,
          a.observacoes,
        ]));
      }} disabled={!dados}>Imprimir PDF</button>
      </div>

      {carregando ? (
        <p className="mt-1">Carregando...</p>
      ) : dados ? (
        <>
          {dados.porStatus.length > 0 && (
            <div className="flex-wrap" style={{ margin: "12px 0" }}>
              {dados.porStatus.map((s) => (
                <span key={s.status} className="status-cargo">{s.status}: {s._count._all}</span>
              ))}
            </div>
          )}
          {dados.agendamentos.length === 0 ? (
            <div className="aviso-vazio">Nenhum atendimento no período.</div>
          ) : (
            <div className="table-responsive mt-1">
              <table className="tabela-pacientes">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Status</th>
                    <th>Paciente</th>
                    <th>Profissional</th>
                    <th>Procedimento</th>
                    <th>Sala</th>
                    <th>Obs.</th>
                  </tr>
                </thead>
                <tbody>
                  {dados.agendamentos.map((a) => (
                    <tr key={a.id}>
                      <td>{new Date(a.dataHora).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</td>
                      <td><span className="status-cargo">{a.status}</span></td>
                      <td>{a.paciente || "—"}</td>
                      <td>{a.profissional || "—"}</td>
                      <td>{a.procedimento || "—"}</td>
                      <td>{a.sala || "—"}</td>
                      <td>{a.observacoes || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}

function RelatorioPacientesTab() {
  const { inicio, fim, setInicio, setFim } = usePeriodo();
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [carregando, setCarregando] = useState(true);

  const carregar = async () => {
    setCarregando(true);
    try {
      let lista = await listarPacientes();
      if (inicio || fim) {
        const de = inicio ? new Date(`${inicio}T00:00:00`).getTime() : -Infinity;
        const ate = fim ? new Date(`${fim}T23:59:59`).getTime() : Infinity;
        lista = lista.filter((p) => {
          const t = new Date(p.criadoEm).getTime();
          return t >= de && t <= ate;
        });
      }
      setPacientes(lista);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inicio, fim]);

  const exportar = () => {
    baixarCsv("relatorio-pacientes", ["Nome", "CPF", "Telefone", "Email", "Convênio", "Status", "Cadastro"], pacientes.map((p) => [
      p.nome,
      p.cpf,
      p.telefone,
      p.email,
      p.convenio?.nome || "",
      p.status,
      new Date(p.criadoEm).toLocaleDateString("pt-BR"),
    ]));
  };

  return (
    <div>
      <PeriodoFiltro inicio={inicio} fim={fim} setInicio={setInicio} setFim={setFim} />
      <div className="toolbar" style={{ gap: 8 }}>
        <button className="btn btn-primary btn-sm" onClick={exportar}>Exportar CSV</button>
        <button className="btn btn-secondary btn-sm" onClick={() => imprimirRelatorio(
        "Relatório de Pacientes",
        ["Nome", "CPF", "Telefone", "Email", "Convênio", "Status", "Cadastro"],
        pacientes.map((p) => [p.nome, p.cpf, p.telefone, p.email, p.convenio?.nome || "", p.status, new Date(p.criadoEm).toLocaleDateString("pt-BR")])
      )}>Imprimir PDF</button>
      </div>

      {carregando ? (
        <p className="mt-1">Carregando...</p>
      ) : pacientes.length === 0 ? (
        <div className="aviso-vazio mt-1">Nenhum paciente no período.</div>
      ) : (
        <div className="table-responsive mt-1">
          <table className="tabela-pacientes">
            <thead>
              <tr>
                <th>Nome</th>
                <th>CPF</th>
                <th>Telefone</th>
                <th>Convênio</th>
                <th>Status</th>
                <th>Cadastro</th>
              </tr>
            </thead>
            <tbody>
              {pacientes.map((p) => (
                <tr key={p.id}>
                  <td>{p.nome}</td>
                  <td>{p.cpf || "—"}</td>
                  <td>{p.telefone || "—"}</td>
                  <td>{p.convenio?.nome || "—"}</td>
                  <td><span className="status-cargo">{p.status}</span></td>
                  <td>{new Date(p.criadoEm).toLocaleDateString("pt-BR")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function RelatorioFinanceiroTab() {
  const { inicio, fim, setInicio, setFim } = usePeriodo();
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [carregando, setCarregando] = useState(true);

  const carregar = async () => {
    setCarregando(true);
    try {
      setLancamentos(await listarLancamentos({
        inicio: inicio ? new Date(`${inicio}T00:00:00`).toISOString() : undefined,
        fim: fim ? new Date(`${fim}T23:59:59`).toISOString() : undefined,
      }));
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inicio, fim]);

  const totalReceita = lancamentos.filter((l) => l.tipo === "receita" && l.status === "pago").reduce((a, l) => a + l.valor, 0);
  const totalPendente = lancamentos.filter((l) => l.tipo === "receita" && l.status === "pendente").reduce((a, l) => a + l.valor, 0);
  const totalDespesa = lancamentos.filter((l) => l.tipo === "despesa" && l.status !== "cancelado").reduce((a, l) => a + l.valor, 0);

  const exportar = () => {
    baixarCsv("relatorio-financeiro", ["Data", "Tipo", "Descrição", "Forma", "Status", "Valor", "Paciente"], lancamentos.map((l) => [
      new Date(l.dataVencimento || l.criadoEm).toLocaleDateString("pt-BR"),
      l.tipo,
      l.descricao,
      l.formaPagamento ? FORMASPAG[l.formaPagamento] || l.formaPagamento : "",
      l.status,
      l.valor,
      l.paciente?.nome || "",
    ]));
  };

  return (
    <div>
      <PeriodoFiltro inicio={inicio} fim={fim} setInicio={setInicio} setFim={setFim} />
      <button className="btn btn-primary btn-sm" onClick={exportar}>Exportar CSV</button>
      <button className="btn btn-secondary btn-sm" onClick={() => imprimirRelatorio(
        "Relatório Financeiro",
        ["Data", "Tipo", "Descrição", "Forma", "Status", "Valor", "Paciente"],
        lancamentos.map((l) => [
          new Date(l.dataVencimento || l.criadoEm).toLocaleDateString("pt-BR"),
          l.tipo,
          l.descricao,
          l.formaPagamento ? FORMASPAG[l.formaPagamento] || l.formaPagamento : "",
          l.status,
          `${l.tipo === "receita" ? "+" : "−"} ${formatarMoeda(l.valor)}`,
          l.paciente?.nome || "",
        ])
      )}>Imprimir PDF</button>

      <div className="widget-grid">
        <div className="card card-compact">
          <div className="text-muted">Recebido</div>
          <div className="font-strong text-success mt-1">{formatarMoeda(totalReceita)}</div>
        </div>
        <div className="card card-compact">
          <div className="text-muted">A receber</div>
          <div className="font-strong text-warning mt-1">{formatarMoeda(totalPendente)}</div>
        </div>
        <div className="card card-compact">
          <div className="text-muted">Despesas</div>
          <div className="font-strong text-danger mt-1">{formatarMoeda(totalDespesa)}</div>
        </div>
      </div>

      {carregando ? (
        <p>Carregando...</p>
      ) : lancamentos.length === 0 ? (
        <div className="aviso-vazio">Nenhum lançamento no período.</div>
      ) : (
        <div className="table-responsive">
          <table className="tabela-pacientes">
            <thead>
              <tr>
                <th>Data</th>
                <th>Tipo</th>
                <th>Descrição</th>
                <th>Forma</th>
                <th>Status</th>
                <th className="text-right">Valor</th>
              </tr>
            </thead>
            <tbody>
              {lancamentos.map((l) => (
                <tr key={l.id}>
                  <td>{new Date(l.dataVencimento || l.criadoEm).toLocaleDateString("pt-BR")}</td>
                  <td><span className="status-cargo">{l.tipo}</span></td>
                  <td>{l.descricao}</td>
                  <td>{l.formaPagamento ? FORMASPAG[l.formaPagamento] || l.formaPagamento : "—"}</td>
                  <td><span className="status-cargo">{l.status}</span></td>
                  <td className={`text-right font-strong ${l.tipo === "receita" ? "text-success" : "text-danger"}`}>
                    {l.tipo === "receita" ? "+ " : "− "}{formatarMoeda(l.valor)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function RelatorioAnalisesTab() {
  const { inicio, fim, setInicio, setFim } = usePeriodo();
  const [dados, setDados] = useState<RelatorioCompleto | null>(null);
  const [carregando, setCarregando] = useState(true);

  const carregar = async () => {
    setCarregando(true);
    try {
      setDados(await obterRelatorioCompleto(inicio ? new Date(`${inicio}T00:00:00`).toISOString() : undefined, fim ? new Date(`${fim}T23:59:59`).toISOString() : undefined));
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inicio, fim]);

  const exportar = () => {
    if (!dados) return;
    const linhas: (string | number)[][] = [];
    for (const p of dados.procedimentosMaisRealizados) linhas.push(["Procedimento", p.nome, p.quantidade, "", ""]);
    for (const p of dados.faturamentoPorProfissional) linhas.push(["Faturamento por profissional", p.nome, "", formatarMoeda(p.valor), ""]);
    linhas.push(["Taxa de faltas", "", `${dados.atendimento.taxaFaltas}%`, "", ""]);
    linhas.push(["Taxa de confirmação", "", `${dados.atendimento.taxaConfirmacao}%`, "", ""]);
    linhas.push(["Comissões totais", "", "", formatarMoeda(dados.comissoes.total), ""]);
    linhas.push(["Comissões pendentes", "", "", formatarMoeda(dados.comissoes.pendentes), ""]);
    for (const r of dados.retornosAtrasados) linhas.push(["Retorno atrasado", r.paciente || "", new Date(r.dataHora).toLocaleDateString("pt-BR"), "", r.profissional || ""]);
    baixarCsv("relatorio-analises", ["Indicador", "Item", "Quantidade", "Valor", "Profissional"], linhas);
  };

  return (
    <div>
      <PeriodoFiltro inicio={inicio} fim={fim} setInicio={setInicio} setFim={setFim} />
      <button className="btn btn-primary btn-sm" onClick={exportar} disabled={!dados}>Exportar CSV</button>
      <button className="btn btn-secondary btn-sm" disabled={!dados} onClick={() => {
        if (!dados) return;
        imprimirRelatorio(
          "Relatório de Análises",
          ["Indicador", "Item", "Quantidade", "Valor", "Profissional"],
          [
            ...dados.procedimentosMaisRealizados.map((p) => ["Procedimento", p.nome, p.quantidade, "", ""] as (string | number)[]),
            ...dados.faturamentoPorProfissional.map((p) => ["Faturamento por profissional", p.nome, "", formatarMoeda(p.valor), ""] as (string | number)[]),
            ["Taxa de faltas", "", `${dados.atendimento.taxaFaltas}%`, "", ""] as (string | number)[],
            ["Taxa de confirmação", "", `${dados.atendimento.taxaConfirmacao}%`, "", ""] as (string | number)[],
            ["Comissões totais", "", "", formatarMoeda(dados.comissoes.total), ""] as (string | number)[],
            ["Comissões pendentes", "", "", formatarMoeda(dados.comissoes.pendentes), ""] as (string | number)[],
            ...dados.retornosAtrasados.map((r) => ["Retorno atrasado", r.paciente || "", new Date(r.dataHora).toLocaleDateString("pt-BR"), "", r.profissional || ""] as (string | number)[]),
          ]
        );
      }}>Imprimir PDF</button>

      {carregando ? (
        <p className="mt-1">Carregando...</p>
      ) : !dados ? null : (
        <div className="grid gap-1 mt-1">
          <div className="card">
            <h3 className="mb-1">Taxas de atendimento</h3>
            <div className="flex-wrap">
              <CartaoIndicador titulo="Realizados" valor={`${dados.atendimento.totalRealizados}`} cor="var(--cor-primaria)" />
              <CartaoIndicador titulo="Taxa de faltas" valor={`${dados.atendimento.taxaFaltas}%`} cor={dados.atendimento.taxaFaltas > 15 ? "#b91c1c" : "#d97706"} />
              <CartaoIndicador titulo="Taxa de confirmação" valor={`${dados.atendimento.taxaConfirmacao}%`} cor="var(--cor-sucesso)" />
              <CartaoIndicador titulo="Comissões pendentes" valor={formatarMoeda(dados.comissoes.pendentes)} cor="#d97706" />
            </div>
          </div>

          {dados.procedimentosMaisRealizados.length > 0 && (
            <div className="card">
              <h3 className="mb-1">Procedimentos mais realizados</h3>
              <table className="tabela-pacientes">
                <thead>
                  <tr><th>Procedimento</th><th className="text-right">Quantidade</th></tr>
                </thead>
                <tbody>
                  {dados.procedimentosMaisRealizados.map((p) => (
                    <tr key={p.nome}>
                      <td>{p.nome}</td>
                      <td className="text-right font-strong">{p.quantidade}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {dados.podeVerFinanceiro && dados.faturamentoPorProfissional.length > 0 && (
            <div className="card">
              <h3 className="mb-1">Faturamento por profissional</h3>
              <table className="tabela-pacientes">
                <thead>
                  <tr><th>Profissional</th><th className="text-right">Faturamento</th></tr>
                </thead>
                <tbody>
                  {dados.faturamentoPorProfissional.map((p) => (
                    <tr key={p.nome}>
                      <td>{p.nome}</td>
                      <td className="text-right font-strong text-success">{formatarMoeda(p.valor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {dados.retornosAtrasados.length > 0 && (
            <div className="card">
              <h3 className="mb-1">Retornos atrasados</h3>
              <div className="historico-cards">
                {dados.retornosAtrasados.map((r) => (
                  <div className="card" key={r.id}>
                    <div className="card-header">
                      <b>{r.paciente || "Paciente"}</b>
                      <span className="status-inativo">Atrasado</span>
                    </div>
                    <div className="text-muted mt-1">
                      {new Date(r.dataHora).toLocaleDateString("pt-BR")} • {r.profissional || "—"}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CartaoIndicador({ titulo, valor, cor }: { titulo: string; valor: string; cor: string }) {
  return (
    <div className="card card-compact">
      <div className="text-muted">{titulo}</div>
      <div className="font-strong" style={{ color: cor, marginTop: 6 }}>{valor}</div>
    </div>
  );
}