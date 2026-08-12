import { FormEvent, useEffect, useState } from "react";
import {
  atualizarProcedimento,
  criarProcedimento,
  definirValorConvenio,
  excluirProcedimento,
  listarProcedimentos,
  Procedimento,
} from "../services/procedimentos";
import { listarConvenios, Convenio } from "../services/convenios";
import { usePermissao } from "../context/PermissaoContext";
import { formatarMoeda, mascaraMoeda, parseMoeda } from "../utils/mascaras";

const formVazio = { nome: "", codigoTuss: "", valorParticular: "", duracaoMedia: "30" };

export default function Procedimentos() {
  const [procedimentos, setProcedimentos] = useState<Procedimento[]>([]);
  const [convenios, setConvenios] = useState<Convenio[]>([]);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [editando, setEditando] = useState<Procedimento | null>(null);
  const [valores, setValores] = useState<Record<string, string>>({});
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [form, setForm] = useState(formVazio);
  const { temPermissao } = usePermissao();

  const podeCriar = temPermissao("procedimentos.criar");
  const podeEditar = temPermissao("procedimentos.editar");
  const podeExcluir = temPermissao("procedimentos.excluir");

  const carregar = async () => {
    try {
      setCarregando(true);
      const [ps, cs] = await Promise.all([listarProcedimentos(), listarConvenios()]);
      setProcedimentos(ps);
      setConvenios(cs);
    } catch (e: any) {
      setErro(e.response?.data?.error || "Erro ao carregar dados");
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
        codigoTuss: form.codigoTuss || null,
        valorParticular: parseMoeda(form.valorParticular),
        duracaoMedia: Number(form.duracaoMedia),
      };
      if (editando) {
        await atualizarProcedimento(editando.id, dados);
      } else {
        await criarProcedimento(dados);
      }
      setForm(formVazio);
      setEditando(null);
      setMostrarForm(false);
      carregar();
    } catch (err: any) {
      setErro(err.response?.data?.error || "Erro ao salvar procedimento");
    }
  }

  function editar(p: Procedimento) {
    setEditando(p);
    setForm({
      nome: p.nome,
      codigoTuss: p.codigoTuss || "",
      valorParticular: mascaraMoeda(String(p.valorParticular ?? "")),
      duracaoMedia: String(p.duracaoMedia),
    });
    setMostrarForm(true);
  }

  async function salvarValorConvenio(procedimentoId: string, convenioId: string, valor: string) {
    if (valor === "") return;
    await definirValorConvenio(procedimentoId, convenioId, parseMoeda(valor));
    carregar();
  }

  async function remover(id: string, nome: string) {
    if (!confirm(`Excluir o procedimento "${nome}"?`)) return;
    try {
      await excluirProcedimento(id);
      carregar();
    } catch (err: any) {
      setErro(err.response?.data?.error || "Erro ao excluir");
    }
  }

  function valorPara(proc: Procedimento, convenioId: string): string {
    const cp = proc.convenios.find((c) => c.convenio.id === convenioId);
    return valores[`${proc.id}:${convenioId}`] ?? (cp ? mascaraMoeda(String(cp.valor)) : "");
  }

  return (
    <div>
      <div className="cabecalho-pagina">
        <h2>Procedimentos</h2>
        {podeCriar && (
          <button className="btn-novo" onClick={() => setMostrarForm((v) => !v)}>
            {mostrarForm ? "Fechar" : "+ Novo procedimento"}
          </button>
        )}
      </div>

      {erro && <p className="text-danger mb-1">{erro}</p>}

      {mostrarForm && (
        <form className="card" onSubmit={salvar}>
          <h3 className="mb-2">{editando ? `Editar: ${editando.nome}` : "Novo procedimento"}</h3>
          <div className="grid-2">
            <div className="field">
              <label>Nome *</label>
              <input required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            </div>
            <div className="field">
              <label>Código TUSS</label>
              <input placeholder="Ex.: 11001017" value={form.codigoTuss} onChange={(e) => setForm({ ...form, codigoTuss: e.target.value })} />
            </div>
            <div className="field">
              <label>Valor particular</label>
              <input
                inputMode="decimal"
                placeholder="R$ 0,00"
                value={form.valorParticular}
                onChange={(e) => setForm({ ...form, valorParticular: mascaraMoeda(e.target.value) })}
              />
            </div>
            <div className="field">
              <label>Duração média (min)</label>
              <input type="number" min={1} value={form.duracaoMedia} onChange={(e) => setForm({ ...form, duracaoMedia: e.target.value })} />
            </div>
          </div>
          <button className="btn btn-primary">{editando ? "Salvar alterações" : "Cadastrar"}</button>
        </form>
      )}

      {carregando ? (
        <p>Carregando...</p>
      ) : procedimentos.length === 0 ? (
        <div className="aviso-vazio">Nenhum procedimento cadastrado.</div>
      ) : (
        <table className="tabela-pacientes">
          <thead>
            <tr>
              <th>Nome</th>
              <th>TUSS</th>
              <th>Particular</th>
              <th>Duração</th>
              {convenios.map((c) => (
                <th key={c.id}>{c.nome}</th>
              ))}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {procedimentos.map((p) => (
              <tr key={p.id}>
                <td>{p.nome}</td>
                <td>{p.codigoTuss || "-"}</td>
                <td>{formatarMoeda(Number(p.valorParticular) || 0)}</td>
                <td>{p.duracaoMedia} min</td>
                {convenios.map((c) => (
                  <td key={c.id}>
                    {podeEditar ? (
                      <input
                        inputMode="decimal"
                        className="input-compact"
                        placeholder="R$ 0,00"
                        value={valorPara(p, c.id)}
                        onChange={(e) => setValores((v) => ({ ...v, [`${p.id}:${c.id}`]: mascaraMoeda(e.target.value) }))}
                        onBlur={() => salvarValorConvenio(p.id, c.id, valorPara(p, c.id))}
                      />
                    ) : (
                      (() => {
                        const cp = p.convenios.find((cc) => cc.convenio.id === c.id);
                        return cp ? formatarMoeda(Number(cp.valor) || 0) : "-";
                      })()
                    )}
                  </td>
                ))}
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
