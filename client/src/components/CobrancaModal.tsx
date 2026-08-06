import { useState } from "react";
import {
  Cobranca,
  criarCobranca,
  FormaPagamento,
  marcarCobrancaPaga,
  obterConfigPagamento,
} from "../services/pagamentos";
import { formatarMoeda } from "../utils/mascaras";

const LABELS: Record<FormaPagamento, string> = {
  pix: "Pix",
  boleto: "Boleto",
  cartao: "Cartão",
};

const ESTILO_INPUT: React.CSSProperties = {
  width: "100%",
  padding: 8,
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  fontSize: 14,
  boxSizing: "border-box",
};

function formatarNumeroCartao(v: string) {
  return v.replace(/\D/g, "").slice(0, 16).replace(/(\d{4})(?=\d)/g, "$1 ");
}

export default function CobrancaModal({
  lancamento,
  onFechar,
  onConcluido,
}: {
  lancamento: { id: string; descricao: string; valor: number };
  onFechar: () => void;
  onConcluido: () => void;
}) {
  const [forma, setForma] = useState<FormaPagamento>("pix");
  const [cobranca, setCobranca] = useState<Cobranca | null>(null);
  const [simulado, setSimulado] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [cartao, setCartao] = useState({
    nome: "",
    numero: "",
    mesValidade: "",
    anoValidade: "",
    cvv: "",
    parcelas: 1,
  });

  async function gerar() {
    setErro("");
    if (forma === "cartao") {
      const anoNum = Number(cartao.anoValidade || 0);
      if (!cartao.nome.trim()) return setErro("Informe o nome impresso no cartão");
      if (cartao.numero.replace(/\D/g, "").length < 13) return setErro("Número do cartão inválido");
      if (!/^\d{2}$/.test(cartao.mesValidade) || Number(cartao.mesValidade) < 1 || Number(cartao.mesValidade) > 12)
        return setErro("Mês de validade inválido (MM)");
      if (!/^\d{4}$/.test(cartao.anoValidade) || anoNum < new Date().getFullYear())
        return setErro("Ano de validade inválido (AAAA)");
      if (!/^\d{3,4}$/.test(cartao.cvv)) return setErro("CVV inválido");
    }

    setCarregando(true);
    try {
      const config = await obterConfigPagamento();
      const c = await criarCobranca(lancamento.id, {
        forma,
        ...(forma === "cartao" ? { cartao: { ...cartao, numero: cartao.numero.replace(/\D/g, "") } } : {}),
      });
      setSimulado(!config.ativa || !config.temCredenciais);
      setCobranca(c);
    } catch (e: any) {
      setErro(e.response?.data?.error || "Erro ao gerar cobrança");
    } finally {
      setCarregando(false);
    }
  }

  async function marcarPago() {
    if (!cobranca) return;
    if (!confirm("Confirmar que esta cobrança foi paga?")) return;
    try {
      await marcarCobrancaPaga(cobranca.id);
      onConcluido();
    } catch (e: any) {
      alert(e.response?.data?.error || "Erro ao marcar como pago");
    }
  }

  function copiar(texto: string) {
    navigator.clipboard?.writeText(texto);
    alert("Copiado!");
  }

  return (
    <div className="modal-overlay" onClick={onFechar}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <h3>Cobrança — {lancamento.descricao}</h3>
          <button className="modal-close" onClick={onFechar}>✕</button>
        </div>

        <div className="modal-body">
          <p style={{ fontSize: 13, color: "#475569", marginBottom: 8 }}>
            Valor: <b>{formatarMoeda(lancamento.valor)}</b>
          </p>

          {!cobranca && (
            <>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
                {(["pix", "boleto", "cartao"] as FormaPagamento[]).map((f) => (
                  <button
                    key={f}
                    className={`btn btn-sm ${forma === f ? "btn-primary" : "btn-secondary"}`}
                    onClick={() => setForma(f)}
                  >
                    {LABELS[f]}
                  </button>
                ))}
              </div>

              {forma === "cartao" && (
                <div style={{ display: "grid", gap: 10, marginBottom: 12 }}>
                  <div>
                    <label style={{ fontSize: 12, color: "#475569" }}>Nome impresso no cartão</label>
                    <input
                      style={ESTILO_INPUT}
                      value={cartao.nome}
                      onChange={(e) => setCartao({ ...cartao, nome: e.target.value })}
                      placeholder="NOME DO TITULAR"
                      maxLength={40}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: "#475569" }}>Número do cartão</label>
                    <input
                      style={ESTILO_INPUT}
                      inputMode="numeric"
                      value={cartao.numero}
                      onChange={(e) => setCartao({ ...cartao, numero: formatarNumeroCartao(e.target.value) })}
                      placeholder="0000 0000 0000 0000"
                    />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                    <div>
                      <label style={{ fontSize: 12, color: "#475569" }}>Validade (MM)</label>
                      <input
                        style={ESTILO_INPUT}
                        inputMode="numeric"
                        maxLength={2}
                        value={cartao.mesValidade}
                        onChange={(e) => setCartao({ ...cartao, mesValidade: e.target.value.replace(/\D/g, "") })}
                        placeholder="MM"
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 12, color: "#475569" }}>Ano (AAAA)</label>
                      <input
                        style={ESTILO_INPUT}
                        inputMode="numeric"
                        maxLength={4}
                        value={cartao.anoValidade}
                        onChange={(e) => setCartao({ ...cartao, anoValidade: e.target.value.replace(/\D/g, "") })}
                        placeholder="AAAA"
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 12, color: "#475569" }}>CVV</label>
                      <input
                        style={ESTILO_INPUT}
                        inputMode="numeric"
                        type="password"
                        maxLength={4}
                        value={cartao.cvv}
                        onChange={(e) => setCartao({ ...cartao, cvv: e.target.value.replace(/\D/g, "") })}
                        placeholder="CVV"
                      />
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: "#475569" }}>Parcelas</label>
                    <select
                      style={ESTILO_INPUT}
                      value={cartao.parcelas}
                      onChange={(e) => setCartao({ ...cartao, parcelas: Number(e.target.value) })}
                    >
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                        <option key={n} value={n}>
                          {n}x de {formatarMoeda(lancamento.valor / n)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <button className="btn btn-primary" onClick={gerar} disabled={carregando}>
                {carregando ? "Gerando..." : "Gerar cobrança"}
              </button>
            </>
          )}

          {cobranca && (
            <div>
              {simulado && (
                <p style={{ fontSize: 13, color: "#b45309", marginBottom: 8 }}>
                  Modo simulação — configure credenciais do gateway em Configurações para cobranças reais.
                </p>
              )}

              {cobranca.status === "paga" && (
                <p style={{ fontSize: 13, color: "var(--cor-sucesso, #15803d)", marginBottom: 8 }}>
                  Pagamento aprovado{cobranca.cartaoUltimosDigitos ? ` — cartão **** ${cobranca.cartaoUltimosDigitos}` : ""}
                  {cobranca.cartaoParcelas ? ` em ${cobranca.cartaoParcelas}x` : ""}. Lançamento baixado.
                </p>
              )}

              {cobranca.pixQrCodeUrl && (
                <div style={{ textAlign: "center", margin: "8px 0" }}>
                  <img
                    src={cobranca.pixQrCodeUrl}
                    alt="QR Code Pix"
                    style={{ width: 180, height: 180, border: "1px solid #e2e8f0", borderRadius: 8 }}
                  />
                </div>
              )}

              {cobranca.pixCopiaECola && (
                <div className="card" style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Pix copia e cola</div>
                  <code style={{ fontSize: 12, wordBreak: "break-all", color: "#334155" }}>{cobranca.pixCopiaECola}</code>
                  <div style={{ marginTop: 6 }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => copiar(cobranca.pixCopiaECola!)}>Copiar</button>
                  </div>
                </div>
              )}

              {cobranca.boletoLinha && (
                <div className="card" style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Linha digitável</div>
                  <code style={{ fontSize: 12, wordBreak: "break-all", color: "#334155" }}>{cobranca.boletoLinha}</code>
                  <div style={{ marginTop: 6 }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => copiar(cobranca.boletoLinha!)}>Copiar</button>
                  </div>
                </div>
              )}

              {cobranca.boletoUrl && (
                <a className="btn btn-secondary btn-sm" href={cobranca.boletoUrl} target="_blank" rel="noreferrer" style={{ marginBottom: 8 }}>
                  Abrir boleto
                </a>
              )}

              {cobranca.status !== "paga" && (
                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  <button className="btn btn-primary" onClick={marcarPago}>Marcar como pago</button>
                  <button className="btn btn-secondary" onClick={onFechar}>Fechar</button>
                </div>
              )}
              {cobranca.status === "paga" && (
                <div style={{ marginTop: 12 }}>
                  <button className="btn btn-primary" onClick={onConcluido}>Concluir</button>
                </div>
              )}
            </div>
          )}

          {erro && <p style={{ color: "var(--cor-perigo)", marginTop: 8 }}>{erro}</p>}
        </div>
      </div>
    </div>
  );
}