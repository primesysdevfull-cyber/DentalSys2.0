import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  criarPaciente,
  excluirPaciente,
  exportarPacientes,
  importarPacientes,
  listarPacientes,
  Paciente,
} from "../services/pacientes";
import { usePermissao } from "../context/PermissaoContext";
import { buscarCep, linkWhatsApp, mascaraCep, mascaraCpf, mascaraTelefone } from "../utils/mascaras";

const formVazio = {
  nome: "",
  cpf: "",
  dataNascimento: "",
  telefone: "",
  whatsapp: "",
  email: "",
  endereco: "",
  complemento: "",
  cep: "",
  contatoEmergencial: "",
  alergias: "",
  indicacao: "",
};

export default function Pacientes() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [busca, setBusca] = useState("");
  const [mostrarForm, setMostrarForm] = useState(() => searchParams.get("novo") === "1");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [form, setForm] = useState(formVazio);
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [erroCep, setErroCep] = useState("");
  const [importando, setImportando] = useState(false);
  const [msgImportacao, setMsgImportacao] = useState("");
  const inputArquivo = useRef<HTMLInputElement>(null);
  const { temPermissao } = usePermissao();

  const podeCriar = temPermissao("pacientes.criar");
  const podeExcluir = temPermissao("pacientes.excluir");

  async function baixarCsv() {
    try {
      const blob = await exportarPacientes();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "pacientes.csv";
      a.click();
      URL.revokeObjectURL(url);
      setErro("");
    } catch (err: any) {
      setErro(err.response?.data?.error || "Erro ao exportar pacientes");
    }
  }

  async function selecionarArquivo(e: ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    setImportando(true);
    setMsgImportacao("");
    setErro("");
    try {
      const resultado = await importarPacientes(arquivo);
      setMsgImportacao(
        `${resultado.importados} paciente(s) importado(s).` +
          (resultado.pulados.cpfDuplicado ? ` ${resultado.pulados.cpfDuplicado} ignorado(s) por CPF duplicado.` : "") +
          (resultado.pulados.semNome ? ` ${resultado.pulados.semNome} ignorado(s) sem nome.` : "") +
          (resultado.erros.length ? ` ${resultado.erros.length} linha(s) com erro.` : "")
      );
      carregar(busca || undefined);
    } catch (err: any) {
      setErro(err.response?.data?.error || "Erro ao importar pacientes");
    } finally {
      setImportando(false);
      if (inputArquivo.current) inputArquivo.current.value = "";
    }
  }

  const carregar = async (termo?: string) => {
    try {
      setCarregando(true);
      setPacientes(await listarPacientes(termo));
    } catch (e: any) {
      setErro(e.response?.data?.error || "Erro ao carregar pacientes");
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregar();
  }, []);

  useEffect(() => {
    const t = setTimeout(() => carregar(busca || undefined), 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca]);

  async function cadastrar(e: FormEvent) {
    e.preventDefault();
    setErro("");
    try {
      await criarPaciente({
        ...form,
        dataNascimento: form.dataNascimento ? new Date(form.dataNascimento).toISOString() : null,
      });
      setForm(formVazio);
      setMostrarForm(false);
      carregar(busca || undefined);
    } catch (err: any) {
      setErro(err.response?.data?.error || "Erro ao cadastrar paciente");
    }
  }

  async function remover(id: string, nome: string) {
    if (!confirm(`Excluir o paciente "${nome}"?`)) return;
    try {
      await excluirPaciente(id);
      carregar(busca || undefined);
    } catch (err: any) {
      setErro(err.response?.data?.error || "Erro ao excluir");
    }
  }

  const atualizar = (campo: string, valor: string) => setForm((f) => ({ ...f, [campo]: valor }));

  async function buscarEnderecoPorCep() {
    setErroCep("");
    if (form.cep.replace(/\D/g, "").length !== 8) {
      setErroCep("Digite um CEP válido com 8 dígitos.");
      return;
    }
    setBuscandoCep(true);
    try {
      const endereco = await buscarCep(form.cep);
      if (endereco) {
        setForm((f) => ({
          ...f,
          cep: mascaraCep(endereco.cep),
          endereco: [endereco.logradouro, endereco.bairro, `${endereco.localidade}/${endereco.uf}`]
            .filter(Boolean)
            .join(", "),
        }));
      } else {
        setErroCep("CEP não encontrado.");
      }
    } catch {
      setErroCep("Erro ao buscar o CEP. Tente novamente.");
    } finally {
      setBuscandoCep(false);
    }
  }

  return (
    <div>
      <div className="cabecalho-pagina">
        <h2>Pacientes</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-secondary" onClick={baixarCsv}>
            Exportar CSV
          </button>
          {podeCriar && (
            <>
              <button className="btn btn-secondary" onClick={() => inputArquivo.current?.click()} disabled={importando}>
                {importando ? "Importando..." : "Importar CSV"}
              </button>
              <input
                ref={inputArquivo}
                type="file"
                accept=".csv,text/csv"
                style={{ display: "none" }}
                onChange={selecionarArquivo}
              />
            </>
          )}
          {podeCriar && (
            <button className="btn-novo" onClick={() => setMostrarForm((v) => !v)}>
              {mostrarForm ? "Fechar" : "+ Novo paciente"}
            </button>
          )}
        </div>
      </div>

      {erro && <p style={{ color: "var(--cor-perigo)", marginBottom: 12 }}>{erro}</p>}
      {msgImportacao && (
        <p style={{ color: "var(--cor-sucesso, #16a34a)", marginBottom: 12 }}>{msgImportacao}</p>
      )}

      {mostrarForm && (
        <form className="card" onSubmit={cadastrar}>
          <h3 style={{ marginBottom: 16 }}>Novo paciente</h3>
          <div className="grid-2">
            <div className="field">
              <label>Nome completo *</label>
              <input required value={form.nome} onChange={(e) => atualizar("nome", e.target.value)} />
            </div>
            <div className="field">
              <label>CPF</label>
              <input
                inputMode="numeric"
                maxLength={14}
                placeholder="000.000.000-00"
                value={form.cpf}
                onChange={(e) => atualizar("cpf", mascaraCpf(e.target.value))}
              />
            </div>
            <div className="field">
              <label>Data de nascimento</label>
              <input type="date" value={form.dataNascimento} onChange={(e) => atualizar("dataNascimento", e.target.value)} />
            </div>
            <div className="field">
              <label>Telefone</label>
              <input value={form.telefone} onChange={(e) => atualizar("telefone", mascaraTelefone(e.target.value))} />
            </div>
            <div className="field">
              <label>WhatsApp</label>
              <input value={form.whatsapp} onChange={(e) => atualizar("whatsapp", mascaraTelefone(e.target.value))} />
            </div>
            <div className="field">
              <label>Email</label>
              <input type="email" value={form.email} onChange={(e) => atualizar("email", e.target.value)} />
            </div>
            <div className="field">
              <label>CEP</label>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  inputMode="numeric"
                  maxLength={9}
                  placeholder="00000-000"
                  value={form.cep}
                  onChange={(e) => atualizar("cep", mascaraCep(e.target.value))}
                />
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={buscarEnderecoPorCep}
                  disabled={buscandoCep}
                >
                  {buscandoCep ? "Buscando..." : "Buscar"}
                </button>
              </div>
              {erroCep && <span style={{ color: "var(--cor-perigo)", fontSize: 12 }}>{erroCep}</span>}
            </div>
            <div className="field">
              <label>Endereço</label>
              <input value={form.endereco} onChange={(e) => atualizar("endereco", e.target.value)} />
            </div>
            <div className="field">
              <label>Complemento</label>
              <input placeholder="Apto, bloco, andar..." value={form.complemento} onChange={(e) => atualizar("complemento", e.target.value)} />
            </div>
            <div className="field">
              <label>Contato emergencial</label>
              <input placeholder="Nome e telefone" value={form.contatoEmergencial} onChange={(e) => atualizar("contatoEmergencial", e.target.value)} />
            </div>
            <div className="field">
              <label>Alergias</label>
              <input placeholder="Ex.: penicilina, látex..." value={form.alergias} onChange={(e) => atualizar("alergias", e.target.value)} />
            </div>
            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <label>Indicação</label>
              <input placeholder="Quem indicou o paciente?" value={form.indicacao} onChange={(e) => atualizar("indicacao", e.target.value)} />
            </div>
          </div>
          <button className="btn btn-primary">Salvar</button>
        </form>
      )}

      <input
        className="busca"
        placeholder="Buscar por nome, CPF ou telefone..."
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
      />

      {carregando ? (
        <p>Carregando...</p>
      ) : pacientes.length === 0 ? (
        <div className="aviso-vazio">Nenhum paciente encontrado.</div>
      ) : (
        <table className="tabela-pacientes">
          <thead>
            <tr>
              <th>Nome</th>
              <th>CPF</th>
              <th>Telefone</th>
              <th>WhatsApp</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {pacientes.map((p) => {
              const whatsApp = linkWhatsApp(p.whatsapp || p.telefone);
              return (
                <tr key={p.id} style={{ cursor: "pointer" }} onClick={() => navigate(`/pacientes/${p.id}`)}>
                  <td style={{ fontWeight: 600, color: "var(--cor-primaria)" }}>{p.nome}</td>
                  <td>{p.cpf || "-"}</td>
                  <td>{p.telefone || "-"}</td>
                  <td>
                    {whatsApp ? (
                      <a
                        href={whatsApp}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: "#16a34a", textDecoration: "none", fontWeight: 600 }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {p.whatsapp ? "WhatsApp" : "Chamar"}
                      </a>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td>
                    <span className={p.status === "ativo" ? "status-ativo" : "status-inativo"}>{p.status}</span>
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    {podeExcluir && (
                      <button className="btn-excluir" onClick={() => remover(p.id, p.nome)}>
                        Excluir
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
