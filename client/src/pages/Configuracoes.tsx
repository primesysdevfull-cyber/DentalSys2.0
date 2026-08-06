import { FormEvent, useEffect, useState } from "react";
import { atualizarClinica, obterClinica, Clinica } from "../services/clinica";
import { ConfigPagamento, obterConfigPagamento, salvarConfigPagamento } from "../services/pagamentos";
import { usePermissao } from "../context/PermissaoContext";

export default function Configuracoes() {
  const [clinica, setClinica] = useState<Clinica | null>(null);
  const [pag, setPag] = useState<ConfigPagamento | null>(null);
  const [salvo, setSalvo] = useState(false);
  const [erro, setErro] = useState("");
  const { temPermissao } = usePermissao();
  const podeEditar = temPermissao("config.editar");

  const carregar = async () => {
    try {
      const [c, p] = await Promise.all([obterClinica(), obterConfigPagamento()]);
      setClinica(c);
      setPag(p);
    } catch (e: any) {
      setErro(e.response?.data?.error || "Erro ao carregar configurações");
    }
  };

  useEffect(() => {
    carregar();
  }, []);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    if (!clinica) return;
    setSalvo(false);
    setErro("");
    try {
      setClinica(await atualizarClinica(clinica));
      setSalvo(true);
      setTimeout(() => setSalvo(false), 2500);
    } catch (err: any) {
      setErro(err.response?.data?.error || "Erro ao salvar");
    }
  }

  async function salvarPagamento(e: FormEvent) {
    e.preventDefault();
    if (!pag) return;
    setErro("");
    try {
      const atualizado = await salvarConfigPagamento({
        provider: pag.provider,
        ambiente: pag.ambiente,
        clientId: pag.clientId || "",
        clientSecret: pag.clientSecret || "",
        pixChave: pag.pixChave || "",
        webhookSecret: pag.webhookSecret || "",
        webhookIp: pag.webhookIp || "",
        ativa: pag.ativa,
      });
      setPag({ ...atualizado });
      alert("Configurações de pagamento salvas.");
    } catch (err: any) {
      setErro(err.response?.data?.error || "Erro ao salvar pagamento");
    }
  }

  if (!clinica || !pag) return <p>Carregando...</p>;

  const atualizar = (campo: string, valor: string) => setClinica((c) => (c ? { ...c, [campo]: valor } : c));
  const atualizarPag = (campo: string, valor: string | boolean) => setPag((p) => (p ? { ...p, [campo]: valor } : p));

  return (
    <div>
      <div className="cabecalho-pagina">
        <h2>Configurações da Clínica</h2>
      </div>

      {erro && <p style={{ color: "var(--cor-perigo)", marginBottom: 12 }}>{erro}</p>}
      {salvo && (
        <p style={{ color: "var(--cor-sucesso)", background: "rgba(34,197,94,0.1)", padding: "0.7rem 1rem", borderRadius: 8, marginBottom: 12 }}>
          Configurações salvas com sucesso.
        </p>
      )}

      <form className="card" onSubmit={salvar} style={{ maxWidth: 720 }}>
        <h3 style={{ marginBottom: 16 }}>Dados gerais</h3>
        <div className="grid-2">
          <div className="field">
            <label>Nome fantasia *</label>
            <input required value={clinica.nome} disabled={!podeEditar} onChange={(e) => atualizar("nome", e.target.value)} />
          </div>
          <div className="field">
            <label>Razão social</label>
            <input value={clinica.razaoSocial || ""} disabled={!podeEditar} onChange={(e) => atualizar("razaoSocial", e.target.value)} />
          </div>
          <div className="field">
            <label>CNPJ</label>
            <input value={clinica.cnpj} disabled={!podeEditar} onChange={(e) => atualizar("cnpj", e.target.value)} />
          </div>
          <div className="field">
            <label>Responsável</label>
            <input value={clinica.responsavel || ""} disabled={!podeEditar} onChange={(e) => atualizar("responsavel", e.target.value)} />
          </div>
          <div className="field">
            <label>Email</label>
            <input type="email" value={clinica.email} disabled={!podeEditar} onChange={(e) => atualizar("email", e.target.value)} />
          </div>
          <div className="field">
            <label>Telefone</label>
            <input value={clinica.telefone || ""} disabled={!podeEditar} onChange={(e) => atualizar("telefone", e.target.value)} />
          </div>
          <div className="field" style={{ gridColumn: "1 / -1" }}>
            <label>Endereço</label>
            <input value={clinica.endereco || ""} disabled={!podeEditar} onChange={(e) => atualizar("endereco", e.target.value)} />
          </div>
        </div>

        {clinica._count && (
          <div style={{ display: "flex", gap: 12, marginTop: 8, marginBottom: 16, flexWrap: "wrap" }}>
            <Contador label="Usuários" valor={clinica._count.usuarios} />
            <Contador label="Pacientes" valor={clinica._count.pacientes} />
            <Contador label="Profissionais" valor={clinica._count.profissionais} />
            <Contador label="Procedimentos" valor={clinica._count.procedimentos} />
            <Contador label="Convênios" valor={clinica._count.convenios} />
          </div>
        )}

        {podeEditar && <button className="btn btn-primary">Salvar configurações</button>}
      </form>

      <form className="card" onSubmit={salvarPagamento} style={{ maxWidth: 720, marginTop: "1.25rem" }}>
        <h3 style={{ marginBottom: 4 }}>Gateway de pagamento (Pix / Boleto)</h3>
        <p style={{ fontSize: 13, color: "#64748b", marginBottom: 16 }}>
          Integração com Efí/Gerencianet. Sem credenciais configuradas, as cobranças são geradas em{" "}
          <b>modo simulação</b>.
        </p>
        <div className="grid-2">
          <div className="field">
            <label>Ambiente</label>
            <select value={pag.ambiente} disabled={!podeEditar} onChange={(e) => atualizarPag("ambiente", e.target.value)}>
              <option value="sandbox">Sandbox (homologação)</option>
              <option value="producao">Produção</option>
            </select>
          </div>
          <div className="field">
            <label>Client ID</label>
            <input value={pag.clientId || ""} disabled={!podeEditar} onChange={(e) => atualizarPag("clientId", e.target.value)} placeholder="client_id da Efí" />
          </div>
          <div className="field">
            <label>Client Secret</label>
            <input value={pag.clientSecret || ""} disabled={!podeEditar} onChange={(e) => atualizarPag("clientSecret", e.target.value)} placeholder="client_secret da Efí" />
          </div>
          <div className="field">
            <label>Chave Pix</label>
            <input value={pag.pixChave || ""} disabled={!podeEditar} onChange={(e) => atualizarPag("pixChave", e.target.value)} placeholder="Chave Pix (para gerar QR real)" />
          </div>
          <div className="field">
            <label>Webhook Secret (HMAC)</label>
            <input value={pag.webhookSecret || ""} disabled={!podeEditar} onChange={(e) => atualizarPag("webhookSecret", e.target.value)} placeholder="Segredo para proteger o webhook" />
          </div>
          <div className="field">
            <label>IP permitido</label>
            <input value={pag.webhookIp || ""} disabled={!podeEditar} onChange={(e) => atualizarPag("webhookIp", e.target.value)} placeholder="Ex.: 34.193.116.226 (Efí Pix)" />
          </div>
          <div className="field" style={{ gridColumn: "1 / -1" }}>
            <details>
              <summary style={{ fontSize: 13, color: "var(--cor-primaria)", cursor: "pointer" }}>
                Como registrar o webhook na Efí (skip-mTLS)
              </summary>
              <div style={{ fontSize: 13, color: "#475569", marginTop: 8, lineHeight: 1.5, display: "grid", gap: 6 }}>
                <p>
                  No painel Efí, registre a URL do webhook adicionando o segredo como query param:
                </p>
                <code style={{ background: "#f1f5f9", padding: "0.5rem 0.75rem", borderRadius: 6 }}>
                  {`https://seuservidor.com/api/pagamentos/webhook?hmac=${pag.webhookSecret || "SEU-SECRETO"}&ignorar=`}
                </code>
                <p>
                  A Efí valida a origem pelo <b>IP</b> (34.193.116.226) e pelo <b>HMAC</b>. Mantenha a URL exata, sem barra
                  final. O parâmetro <code>ignorar=</code> evita que a Efí adicione <code>/pix</code> ao final da rota.
                </p>
              </div>
            </details>
          </div>
          <div className="field" style={{ gridColumn: "1 / -1" }}>
            <label>
              <input type="checkbox" checked={pag.ativa} disabled={!podeEditar} onChange={(e) => atualizarPag("ativa", e.target.checked)} />
              {" "}Ativar gateway (usa credenciais reais)
            </label>
          </div>
        </div>
        {podeEditar && <button className="btn btn-primary">Salvar gateway</button>}
      </form>
    </div>
  );
}

function Contador({ label, valor }: { label: string; valor: number }) {
  return (
    <div style={{ background: "#f1f5f9", borderRadius: 8, padding: "0.5rem 1rem", textAlign: "center" }}>
      <div style={{ fontSize: 18, fontWeight: 700 }}>{valor}</div>
      <div style={{ fontSize: 12, color: "#64748b" }}>{label}</div>
    </div>
  );
}
