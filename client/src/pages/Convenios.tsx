import { FormEvent, useEffect, useState } from "react";
import {
  atualizarConvenio,
  criarConvenio,
  excluirConvenio,
  listarConvenios,
  Convenio,
} from "../services/convenios";
import { usePermissao } from "../context/PermissaoContext";

const formVazio = { nome: "", registro: "", telefone: "" };

export default function Convenios() {
  const [convenios, setConvenios] = useState<Convenio[]>([]);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [editando, setEditando] = useState<Convenio | null>(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [form, setForm] = useState(formVazio);
  const { temPermissao } = usePermissao();

  const podeCriar = temPermissao("convenios.criar");
  const podeEditar = temPermissao("convenios.editar");
  const podeExcluir = temPermissao("convenios.excluir");

  const carregar = async () => {
    try {
      setCarregando(true);
      setConvenios(await listarConvenios());
    } catch (e: any) {
      setErro(e.response?.data?.error || "Erro ao carregar convênios");
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
        registro: form.registro || null,
        telefone: form.telefone || null,
      };
      if (editando) {
        await atualizarConvenio(editando.id, dados);
      } else {
        await criarConvenio(dados);
      }
      setForm(formVazio);
      setEditando(null);
      setMostrarForm(false);
      carregar();
    } catch (err: any) {
      setErro(err.response?.data?.error || "Erro ao salvar convênio");
    }
  }

  function editar(c: Convenio) {
    setEditando(c);
    setForm({ nome: c.nome, registro: c.registro || "", telefone: c.telefone || "" });
    setMostrarForm(true);
  }

  async function remover(id: string, nome: string) {
    if (!confirm(`Excluir o convênio "${nome}"?`)) return;
    try {
      await excluirConvenio(id);
      carregar();
    } catch (err: any) {
      setErro(err.response?.data?.error || "Erro ao excluir");
    }
  }

  return (
    <div>
      <div className="cabecalho-pagina">
        <h2>Convênios</h2>
        {podeCriar && (
          <button className="btn-novo" onClick={() => setMostrarForm((v) => !v)}>
            {mostrarForm ? "Fechar" : "+ Novo convênio"}
          </button>
        )}
      </div>

      {erro && <p style={{ color: "var(--cor-perigo)", marginBottom: 12 }}>{erro}</p>}

      {mostrarForm && (
        <form className="card" onSubmit={salvar}>
          <h3 style={{ marginBottom: 16 }}>{editando ? `Editar: ${editando.nome}` : "Novo convênio"}</h3>
          <div className="grid-2">
            <div className="field">
              <label>Nome *</label>
              <input required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            </div>
            <div className="field">
              <label>Registro (ANS)</label>
              <input value={form.registro} onChange={(e) => setForm({ ...form, registro: e.target.value })} />
            </div>
            <div className="field">
              <label>Telefone</label>
              <input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} />
            </div>
          </div>
          <button className="btn btn-primary">{editando ? "Salvar alterações" : "Cadastrar"}</button>
        </form>
      )}

      {carregando ? (
        <p>Carregando...</p>
      ) : convenios.length === 0 ? (
        <div className="aviso-vazio">Nenhum convênio cadastrado.</div>
      ) : (
        <table className="tabela-pacientes">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Registro</th>
              <th>Telefone</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {convenios.map((c) => (
              <tr key={c.id}>
                <td>{c.nome}</td>
                <td>{c.registro || "-"}</td>
                <td>{c.telefone || "-"}</td>
                <td>
                  <span className={c.ativo ? "status-ativo" : "status-inativo"}>
                    {c.ativo ? "ativo" : "inativo"}
                  </span>
                </td>
                <td style={{ whiteSpace: "nowrap" }}>
                  {podeEditar && (
                    <button className="btn-editar" onClick={() => editar(c)}>
                      Editar
                    </button>
                  )}
                  {podeExcluir && (
                    <button className="btn-excluir" onClick={() => remover(c.id, c.nome)}>
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
