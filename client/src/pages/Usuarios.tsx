import { FormEvent, useEffect, useState } from "react";
import {
  alternarAtivo,
  atualizarUsuario,
  criarUsuario,
  listarUsuarios,
  Usuario,
} from "../services/usuarios";
import { Cargo } from "../services/auth";

const formVazio = { nome: "", email: "", senha: "", cargo: "recepcionista" as Cargo };

const rotulosCargo: Record<string, string> = {
  administrador: "Administrador",
  dentista: "Dentista",
  recepcionista: "Recepcionista",
};

export default function Usuarios() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [editando, setEditando] = useState<Usuario | null>(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [form, setForm] = useState(formVazio);

  const carregar = async () => {
    try {
      setCarregando(true);
      setUsuarios(await listarUsuarios());
    } catch (e: any) {
      setErro(e.response?.data?.error || "Erro ao carregar usuários");
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
        email: form.email,
        senha: form.senha || undefined,
        cargo: form.cargo,
      };
      if (editando) {
        await atualizarUsuario(editando.id, dados);
      } else {
        await criarUsuario(dados);
      }
      setForm(formVazio);
      setEditando(null);
      setMostrarForm(false);
      carregar();
    } catch (err: any) {
      setErro(err.response?.data?.error || "Erro ao salvar usuário");
    }
  }

  function editar(u: Usuario) {
    setEditando(u);
    setForm({ nome: u.nome, email: u.email, senha: "", cargo: u.cargo });
    setMostrarForm(true);
  }

  async function alternar(u: Usuario) {
    try {
      await alternarAtivo(u.id);
      carregar();
    } catch (err: any) {
      setErro(err.response?.data?.error || "Erro ao alternar status");
    }
  }

  return (
    <div>
      <div className="cabecalho-pagina">
        <h2>Usuários e Permissões</h2>
        <button className="btn-novo" onClick={() => setMostrarForm((v) => !v)}>
          {mostrarForm ? "Fechar" : "+ Novo usuário"}
        </button>
      </div>

      {erro && <p className="text-danger mb-1">{erro}</p>}

      <div className="card card-info">
        <strong className="font-strong">Permissões por cargo</strong>
        <ul className="text-muted mt-1 pl-5">
          <li><b>Administrador:</b> acesso total ao sistema.</li>
          <li><b>Dentista:</b> vê e edita pacientes e prontuário clínico; não exclui nem gerencia financeiro/usuários.</li>
          <li><b>Recepcionista:</b> cadastra e edita pacientes, mas <b>não vê prontuário clínico</b>.</li>
        </ul>
      </div>

      {mostrarForm && (
        <form className="card" onSubmit={salvar}>
          <h3 className="mb-2">{editando ? `Editar: ${editando.nome}` : "Novo usuário"}</h3>
          <div className="grid-2">
            <div className="field">
              <label>Nome *</label>
              <input required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            </div>
            <div className="field">
              <label>Email *</label>
              <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="field">
              <label>Senha {editando ? "(deixe vazio para manter)" : ""}</label>
              <input type="password" minLength={6} value={form.senha} onChange={(e) => setForm({ ...form, senha: e.target.value })} />
            </div>
            <div className="field">
              <label>Cargo</label>
              <select value={form.cargo} onChange={(e) => setForm({ ...form, cargo: e.target.value as Cargo })}>
                <option value="administrador">Administrador</option>
                <option value="dentista">Dentista</option>
                <option value="recepcionista">Recepcionista</option>
              </select>
            </div>
          </div>
          <button className="btn btn-primary">{editando ? "Salvar alterações" : "Cadastrar"}</button>
        </form>
      )}

      {carregando ? (
        <p>Carregando...</p>
      ) : (
        <table className="tabela-pacientes">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Email</th>
              <th>Cargo</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u) => (
              <tr key={u.id}>
                <td>{u.nome}</td>
                <td>{u.email}</td>
                <td>
                  <span className="status-cargo">{rotulosCargo[u.cargo] || u.cargo}</span>
                </td>
                <td>
                  <span className={u.ativo ? "status-ativo" : "status-inativo"}>
                    {u.ativo ? "ativo" : "inativo"}
                  </span>
                </td>
                <td className="nowrap">
                  <button className="btn-editar" onClick={() => editar(u)}>
                    Editar
                  </button>
                  <button className="btn-excluir" onClick={() => alternar(u)}>
                    {u.ativo ? "Desativar" : "Ativar"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
