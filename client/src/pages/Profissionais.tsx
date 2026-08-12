import { FormEvent, useEffect, useState } from "react";
import {
  atualizarProfissional,
  criarProfissional,
  excluirProfissional,
  listarProfissionais,
  Profissional,
} from "../services/profissionais";
import { usePermissao } from "../context/PermissaoContext";

const formVazio = {
  nome: "",
  cro: "",
  especialidade: "",
  horarioAtendimento: "",
  comissao: "0",
  email: "",
  senha: "",
  cargo: "dentista" as "dentista" | "recepcionista",
};

export default function Profissionais() {
  const [profissionais, setProfissionais] = useState<Profissional[]>([]);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [editando, setEditando] = useState<Profissional | null>(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [form, setForm] = useState(formVazio);
  const { temPermissao } = usePermissao();

  const podeCriar = temPermissao("profissionais.criar");
  const podeEditar = temPermissao("profissionais.editar");
  const podeExcluir = temPermissao("profissionais.excluir");

  const carregar = async () => {
    try {
      setCarregando(true);
      setProfissionais(await listarProfissionais());
    } catch (e: any) {
      setErro(e.response?.data?.error || "Erro ao carregar profissionais");
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregar();
  }, []);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setErro("");
    try {
      const dados = {
        nome: form.nome,
        cro: form.cro,
        especialidade: form.especialidade || null,
        horarioAtendimento: form.horarioAtendimento || null,
        comissao: Number(form.comissao),
        email: form.email,
        senha: form.senha || undefined,
        cargo: form.cargo,
      };
      if (editando) {
        await atualizarProfissional(editando.id, dados);
      } else {
        await criarProfissional(dados);
      }
      setForm(formVazio);
      setEditando(null);
      setMostrarForm(false);
      carregar();
    } catch (err: any) {
      setErro(err.response?.data?.error || "Erro ao salvar profissional");
    }
  }

  function editar(p: Profissional) {
    setEditando(p);
    setForm({
      nome: p.nome,
      cro: p.cro,
      especialidade: p.especialidade || "",
      horarioAtendimento: p.horarioAtendimento || "",
      comissao: String(p.comissao),
      email: p.usuario.email,
      senha: "",
      cargo: p.usuario.cargo === "dentista" || p.usuario.cargo === "recepcionista" ? p.usuario.cargo : "dentista",
    });
    setMostrarForm(true);
  }

  async function remover(id: string, nome: string) {
    if (!confirm(`Excluir o profissional "${nome}"?`)) return;
    try {
      await excluirProfissional(id);
      carregar();
    } catch (err: any) {
      setErro(err.response?.data?.error || "Erro ao excluir");
    }
  }

  return (
    <div>
      <div className="cabecalho-pagina">
        <h2>Profissionais / Colaboradores</h2>
        {podeCriar && (
          <button className="btn-novo" onClick={() => setMostrarForm((v) => !v)}>
            {mostrarForm ? "Fechar" : "+ Novo profissional"}
          </button>
        )}
      </div>

      {erro && <p className="text-danger mb-1">{erro}</p>}

      {mostrarForm && (
        <form className="card" onSubmit={salvar}>
          <h3 className="mb-2">{editando ? `Editar: ${editando.nome}` : "Novo profissional"}</h3>
          <div className="grid-2">
            <div className="field">
              <label>Nome completo *</label>
              <input required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            </div>
            <div className="field">
              <label>CRO *</label>
              <input required placeholder="Ex.: SP 45.678" value={form.cro} onChange={(e) => setForm({ ...form, cro: e.target.value })} />
            </div>
            <div className="field">
              <label>Especialidade</label>
              <input placeholder="Ex.: Ortodontia, Endodontia..." value={form.especialidade} onChange={(e) => setForm({ ...form, especialidade: e.target.value })} />
            </div>
            <div className="field">
              <label>Horário de atendimento</label>
              <input placeholder="Ex.: Seg-Sex 08:00-17:00" value={form.horarioAtendimento} onChange={(e) => setForm({ ...form, horarioAtendimento: e.target.value })} />
            </div>
            <div className="field">
              <label>Comissão (%)</label>
              <input type="number" min={0} max={100} value={form.comissao} onChange={(e) => setForm({ ...form, comissao: e.target.value })} />
            </div>
            <div className="field">
              <label>Cargo</label>
              <select value={form.cargo} onChange={(e) => setForm({ ...form, cargo: e.target.value as any })}>
                <option value="dentista">Dentista</option>
                <option value="recepcionista">Recepcionista</option>
              </select>
            </div>
            <div className="field">
              <label>Email de acesso *</label>
              <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="field">
              <label>Senha de acesso {editando ? "(deixe vazio para manter)" : ""}</label>
              <input type="password" minLength={6} value={form.senha} onChange={(e) => setForm({ ...form, senha: e.target.value })} />
            </div>
          </div>
          <button className="btn btn-primary">{editando ? "Salvar alterações" : "Cadastrar"}</button>
        </form>
      )}

      {carregando ? (
        <p>Carregando...</p>
      ) : profissionais.length === 0 ? (
        <div className="aviso-vazio">Nenhum profissional cadastrado.</div>
      ) : (
        <table className="tabela-pacientes">
          <thead>
            <tr>
              <th>Nome</th>
              <th>CRO</th>
              <th>Especialidade</th>
              <th>Horário</th>
              <th>Comissão</th>
              <th>Cargo</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {profissionais.map((p) => (
              <tr key={p.id}>
                <td>{p.nome}</td>
                <td>{p.cro}</td>
                <td>{p.especialidade || "-"}</td>
                <td>{p.horarioAtendimento || "-"}</td>
                <td>{String(p.comissao)}%</td>
                <td>
                  <span className="status-cargo">{p.usuario.cargo}</span>
                </td>
                <td className="nowrap">
                  {podeEditar && (
                    <button className="btn-editar" onClick={() => editar(p)}>
                      Editar
                    </button>
                  )}
                  {podeExcluir && (
                    <button className="btn-excluir" onClick={() => remover(p.id, p.nome)}>
                      Excluir
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
