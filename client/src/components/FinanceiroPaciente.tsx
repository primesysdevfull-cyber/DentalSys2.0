import { useEffect, useState } from "react";
import {
  baixarLancamento,
  Lancamento,
  listarLancamentos,
} from "../services/financeiro";
import { usePermissao } from "../context/PermissaoContext";
import { formatarMoeda } from "../utils/mascaras";

export function FinanceiroPaciente({ pacienteId }: { pacienteId: string }) {
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [resumo, setResumo] = useState<{ totalRecebido: number; aReceber: number } | null>(null);
  const [carregando, setCarregando] = useState(true);
  const { temPermissao } = usePermissao();
  const podeBaixar = temPermissao("financeiro.baixar");

  const carregar = async () => {
    setCarregando(true);
    try {
      const lanc = await listarLancamentos({ pacienteId });
      setLancamentos(lanc);
      const pagos = lanc.filter((l) => l.status === "pago" && l.tipo === "receita");
      const pendentes = lanc.filter((l) => l.status === "pendente" && l.tipo === "receita");
      setResumo({
        totalRecebido: Math.round(pagos.reduce((acc, l) => acc + l.valor, 0) * 100) / 100,
        aReceber: Math.round(pendentes.reduce((acc, l) => acc + l.valor, 0) * 100) / 100,
      });
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pacienteId]);

  const receber = async (id: string) => {
    if (!confirm("Confirmar recebimento deste lançamento?")) return;
    await baixarLancamento(id);
    carregar();
  };

  if (carregando) return <p>Carregando...</p>;

  return (
    <div>
      {resumo && (
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: "1.25rem" }}>
          <div className="card" style={{ flex: 1, minWidth: 180 }}>
            <div style={{ fontSize: 13, color: "#64748b", fontWeight: 600 }}>Pago por este paciente</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: "var(--cor-sucesso)", marginTop: 6 }}>
              {formatarMoeda(resumo.totalRecebido)}
            </div>
          </div>
          <div className="card" style={{ flex: 1, minWidth: 180 }}>
            <div style={{ fontSize: 13, color: "#64748b", fontWeight: 600 }}>A receber deste paciente</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: "#d97706", marginTop: 6 }}>
              {formatarMoeda(resumo.aReceber)}
            </div>
          </div>
        </div>
      )}

      <p style={{ fontSize: 14, color: "#475569", marginBottom: "1rem" }}>
        Lançamentos financeiros vinculados a este paciente. Para novos lançamentos, use o menu Financeiro.
      </p>

      {lancamentos.length === 0 ? (
        <div className="aviso-vazio">Nenhum lançamento financeiro para este paciente.</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="tabela-pacientes">
            <thead>
              <tr>
                <th>Data</th>
                <th>Descrição</th>
                <th style={{ textAlign: "right" }}>Valor</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {lancamentos.map((l) => (
                <tr key={l.id}>
                  <td>{new Date(l.dataVencimento || l.criadoEm).toLocaleDateString("pt-BR")}</td>
                  <td>
                    {l.descricao}
                    {l.comissao !== null && (
                      <span style={{ fontSize: 12, color: "#64748b" }}> (comissão {formatarMoeda(l.comissao)})</span>
                    )}
                  </td>
                  <td style={{ textAlign: "right", fontWeight: 600, color: l.tipo === "receita" ? "var(--cor-sucesso)" : "#b91c1c" }}>
                    {l.tipo === "receita" ? "+ " : "− "}{formatarMoeda(l.valor)}
                  </td>
                  <td>
                    <span
                      className="status-cargo"
                      style={l.status === "pago" ? undefined : l.status === "cancelado" ? undefined : { background: "#fef3c7", color: "#92400e" }}
                    >
                      {l.status === "pago" ? "Pago" : l.status === "cancelado" ? "Cancelado" : "Pendente"}
                    </span>
                  </td>
                  <td>
                    {podeBaixar && l.status === "pendente" && l.tipo === "receita" && (
                      <button className="btn btn-primary btn-sm" onClick={() => receber(l.id)}>Receber</button>
                    )}
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
