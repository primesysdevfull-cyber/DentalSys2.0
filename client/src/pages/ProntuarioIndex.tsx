import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listarPacientes, Paciente } from "../services/pacientes";
import { usePermissao } from "../context/PermissaoContext";

export default function ProntuarioIndex() {
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [busca, setBusca] = useState("");
  const [inicial, setInicial] = useState("");
  const [carregando, setCarregando] = useState(true);
  const { temPermissao } = usePermissao();

  useEffect(() => {
    listarPacientes(busca || undefined)
      .then(setPacientes)
      .catch(() => setPacientes([]))
      .finally(() => setCarregando(false));
  }, [busca]);

  if (!temPermissao("prontuario.ver")) {
    return <div className="aviso-vazio">Seu cargo não tem permissão para acessar prontuários.</div>;
  }

  const filtrados = (inicial ? pacientes.filter((p) => p.nome.trim().toUpperCase().startsWith(inicial)) : pacientes).sort(
    (a, b) => a.nome.localeCompare(b.nome)
  );

  const iniciais = Array.from(new Set(pacientes.map((p) => p.nome.trim().charAt(0).toUpperCase())))
    .filter((l) => /[A-ZÀ-Ú]/.test(l))
    .sort();

  return (
    <div>
      <div className="cabecalho-pagina">
        <h2>Prontuários</h2>
      </div>

      <div className="lista-busca" style={{ marginBottom: 12 }}>
        <input
          className="busca"
          placeholder="Buscar paciente..."
          value={busca}
          onChange={(e) => {
            setBusca(e.target.value);
            setInicial("");
          }}
        />
      </div>

      {iniciais.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
          <button className={`btn btn-sm ${inicial === "" ? "btn-primary" : "btn-secondary"}`} onClick={() => setInicial("")}>
            Todos
          </button>
          {iniciais.map((l) => (
            <button
              key={l}
              className={`btn btn-sm ${inicial === l ? "btn-primary" : "btn-secondary"}`}
              onClick={() => {
                setInicial(l);
                setBusca("");
              }}
            >
              {l}
            </button>
          ))}
        </div>
      )}

      {carregando ? (
        <p>Carregando...</p>
      ) : filtrados.length === 0 ? (
        <p className="aviso-vazio">Nenhum paciente encontrado.</p>
      ) : (
        <div className="tabela-card">
          <table className="tabela-pacientes">
            <thead>
              <tr>
                <th>Paciente</th>
                <th>CPF</th>
                <th>Telefone</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((p) => (
                <tr key={p.id}>
                  <td style={{ fontWeight: 600 }}>{p.nome}</td>
                  <td>{p.cpf || "—"}</td>
                  <td>{p.telefone || p.whatsapp || "—"}</td>
                  <td style={{ textAlign: "right" }}>
                    <Link to={`/pacientes/${p.id}?aba=prontuario`} className="btn btn-primary btn-sm">
                      Acessar prontuário
                    </Link>
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