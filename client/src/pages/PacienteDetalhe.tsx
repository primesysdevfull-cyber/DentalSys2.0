import { FormEvent, useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  atualizarPaciente,
  obterPaciente,
  Paciente,
} from "../services/pacientes";
import { listarConvenios, Convenio } from "../services/convenios";
import { historicoAtendimentos, Atendimento } from "../services/agenda";
import { usePermissao } from "../context/PermissaoContext";
import { buscarCep, linkWhatsApp, mascaraCep, mascaraCpf, mascaraTelefone } from "../utils/mascaras";
import ProntuarioClinico from "../components/ProntuarioClinico";
import { FinanceiroPaciente } from "../components/FinanceiroPaciente";

type Aba = "dados" | "contato" | "anamnese" | "prontuario" | "financeiro" | "retornos";

export default function PacienteDetalhe() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const [paciente, setPaciente] = useState<Paciente | null>(null);
  const [erro, setErro] = useState("");
  const [editando, setEditando] = useState(false);
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [erroCep, setErroCep] = useState("");
  const [aba, setAba] = useState<Aba>(() => {
    const param = searchParams.get("aba");
    return param === "prontuario" ? "prontuario" : "dados";
  });
  const [convenios, setConvenios] = useState<Convenio[]>([]);
  const [retornos, setRetornos] = useState<Atendimento[]>([]);
  const [carregandoRetornos, setCarregandoRetornos] = useState(false);
  const { temPermissao } = usePermissao();

  const podeVerProntuario = temPermissao("prontuario.ver");
  const podeEditar = temPermissao("pacientes.editar");

  const carregar = async () => {
    try {
      const [pac, convs] = await Promise.all([obterPaciente(id!), listarConvenios()]);
      setPaciente(pac);
      setConvenios(convs);
    } catch (e: any) {
      setErro(e.response?.data?.error || "Paciente não encontrado");
    }
  };

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (aba === "retornos" && id && paciente) {
      setCarregandoRetornos(true);
      historicoAtendimentos(id)
        .then((atendimentos) => {
          const ret = atendimentos.filter((a) => a.status === "atendido");
          setRetornos(ret);
        })
        .catch(() => setRetornos([]))
        .finally(() => setCarregandoRetornos(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aba, id]);

  if (erro) {
    return (
      <div>
        <p style={{ color: "#b42318" }}>{erro}</p>
        <Link to="/pacientes">Voltar</Link>
      </div>
    );
  }

  if (!paciente) return <p>Carregando...</p>;

  const atual = paciente;
  const wa = linkWhatsApp(paciente.whatsapp || paciente.telefone);

  const salvarEdicao = async (e: FormEvent) => {
    e.preventDefault();
    await atualizarPaciente(atual.id, {
      nome: atual.nome,
      cpf: atual.cpf,
      telefone: atual.telefone,
      whatsapp: atual.whatsapp,
      email: atual.email,
      endereco: atual.endereco,
      complemento: atual.complemento,
      cep: atual.cep,
      contatoEmergencial: atual.contatoEmergencial,
      alergias: atual.alergias,
      indicacao: atual.indicacao,
      observacoes: atual.observacoes,
      convenioId: atual.convenioId,
      dataNascimento: atual.dataNascimento,
    });
    setEditando(false);
    carregar();
  };

  const buscarEnderecoPorCep = async () => {
    setErroCep("");
    if (!atual.cep || atual.cep.replace(/\D/g, "").length !== 8) {
      setErroCep("Digite um CEP válido com 8 dígitos.");
      return;
    }
    setBuscandoCep(true);
    try {
      const endereco = await buscarCep(atual.cep);
      if (endereco) {
        setPaciente({
          ...atual,
          cep: mascaraCep(endereco.cep),
          endereco: [endereco.logradouro, endereco.bairro, `${endereco.localidade}/${endereco.uf}`]
            .filter(Boolean)
            .join(", "),
        });
      } else {
        setErroCep("CEP não encontrado.");
      }
    } catch {
      setErroCep("Erro ao buscar o CEP. Tente novamente.");
    } finally {
      setBuscandoCep(false);
    }
  };

  const atualizarCampo = (campo: keyof Paciente, valor: string | null) =>
    setPaciente({ ...atual, [campo]: valor });

  const abas: { chave: Aba; label: string }[] = [
    { chave: "dados", label: "Dados Gerais" },
    { chave: "contato", label: "Contato" },
    { chave: "anamnese", label: "Anamnese" },
    { chave: "prontuario", label: "Prontuário" },
    { chave: "financeiro", label: "Financeiro" },
    { chave: "retornos", label: "Retornos" },
  ];

  return (
    <div>
      <Link to="/pacientes" style={{ color: "var(--cor-primaria)", fontSize: 14 }}>
        &larr; Voltar para pacientes
      </Link>

      <div className="cabecalho-pagina">
        <h2>{paciente.nome}</h2>
        {podeEditar && (
          <button className="btn-novo" onClick={() => setEditando((v) => !v)}>
            {editando ? "Cancelar edição" : "Editar"}
          </button>
        )}
      </div>

      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginBottom: "1.25rem", alignItems: "center" }}>
        <div style={{ fontSize: 14, color: "#475569" }}>
          {paciente.cpf && <>CPF: <b>{paciente.cpf}</b> • </>}
          {paciente.convenio?.nome ? <>Convênio: <b>{paciente.convenio.nome}</b></> : "Sem convênio"}
        </div>
        {wa && (
          <a
            href={wa}
            target="_blank"
            rel="noreferrer"
            className="btn btn-secondary btn-sm"
            style={{ textDecoration: "none", color: "#16a34a" }}
          >
            💬 WhatsApp
          </a>
        )}
      </div>

      <div className="agenda-tabs" style={{ marginBottom: "1.25rem" }}>
        {abas.map((a) => (
          <button
            key={a.chave}
            className={`agenda-tab ${aba === a.chave ? "ativo" : ""}`}
            onClick={() => setAba(a.chave)}
          >
            {a.label}
          </button>
        ))}
      </div>

      {erroCep && <p style={{ color: "var(--cor-perigo)", marginBottom: 12 }}>{erroCep}</p>}

      {(aba === "dados" || aba === "contato" || aba === "anamnese") && (
        <form className="card" onSubmit={salvarEdicao}>
          {editando ? (
            <>
              {aba === "dados" && (
                <div className="grid-2">
                  <div className="field">
                    <label>Nome completo *</label>
                    <input required value={paciente.nome} onChange={(e) => atualizarCampo("nome", e.target.value)} />
                  </div>
                  <div className="field">
                    <label>CPF</label>
                    <input
                      inputMode="numeric"
                      maxLength={14}
                      placeholder="000.000.000-00"
                      value={atual.cpf || ""}
                      onChange={(e) => atualizarCampo("cpf", mascaraCpf(e.target.value))}
                    />
                  </div>
                  <div className="field">
                    <label>Data de nascimento</label>
                    <input
                      type="date"
                      value={atual.dataNascimento ? atual.dataNascimento.slice(0, 10) : ""}
                      onChange={(e) => atualizarCampo("dataNascimento", e.target.value ? new Date(e.target.value).toISOString() : null)}
                    />
                  </div>
                  <div className="field">
                    <label>RG</label>
                    <input value={atual.rg || ""} onChange={(e) => atualizarCampo("rg", e.target.value)} />
                  </div>
                  <div className="field">
                    <label>Convênio</label>
                    <select value={atual.convenioId || ""} onChange={(e) => atualizarCampo("convenioId", e.target.value || null)}>
                      <option value="">Sem convênio</option>
                      {convenios.map((c) => (
                        <option key={c.id} value={c.id}>{c.nome}</option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label>Status</label>
                    <select value={atual.status} onChange={(e) => atualizarCampo("status", e.target.value)}>
                      <option value="ativo">Ativo</option>
                      <option value="inativo">Inativo</option>
                    </select>
                  </div>
                </div>
              )}

              {aba === "contato" && (
                <div className="grid-2">
                  <div className="field">
                    <label>Telefone</label>
                    <input value={atual.telefone || ""} onChange={(e) => atualizarCampo("telefone", mascaraTelefone(e.target.value))} />
                  </div>
                  <div className="field">
                    <label>WhatsApp</label>
                    <input value={atual.whatsapp || ""} onChange={(e) => atualizarCampo("whatsapp", mascaraTelefone(e.target.value))} />
                  </div>
                  <div className="field">
                    <label>Email</label>
                    <input type="email" value={atual.email || ""} onChange={(e) => atualizarCampo("email", e.target.value)} />
                  </div>
                  <div className="field">
                    <label>Contato emergencial</label>
                    <input value={atual.contatoEmergencial || ""} onChange={(e) => atualizarCampo("contatoEmergencial", mascaraTelefone(e.target.value))} />
                  </div>
                  <div className="field">
                    <label>CEP</label>
                    <div style={{ display: "flex", gap: 8 }}>
                      <input
                        inputMode="numeric"
                        maxLength={9}
                        placeholder="00000-000"
                        value={atual.cep || ""}
                        onChange={(e) => atualizarCampo("cep", mascaraCep(e.target.value))}
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
                  </div>
                  <div className="field">
                    <label>Endereço</label>
                    <input value={atual.endereco || ""} onChange={(e) => atualizarCampo("endereco", e.target.value)} />
                  </div>
                  <div className="field">
                    <label>Complemento</label>
                    <input placeholder="Apto, bloco, andar..." value={atual.complemento || ""} onChange={(e) => atualizarCampo("complemento", e.target.value)} />
                  </div>
                </div>
              )}

              {aba === "anamnese" && (
                <>
                  <div className="field">
                    <label>Alergias</label>
                    <input placeholder="Ex.: penicilina, látex..." value={atual.alergias || ""} onChange={(e) => atualizarCampo("alergias", e.target.value)} />
                  </div>
                  <div className="field">
                    <label>Indicação</label>
                    <input value={atual.indicacao || ""} onChange={(e) => atualizarCampo("indicacao", e.target.value)} />
                  </div>
                  <div className="field">
                    <label>Cuidados especiais / Observações</label>
                    <textarea rows={4} value={atual.observacoes || ""} onChange={(e) => atualizarCampo("observacoes", e.target.value)} />
                  </div>
                </>
              )}
              <button className="btn btn-primary">Salvar alterações</button>
            </>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
              {aba === "dados" && (
                <>
                  <Info label="CPF" valor={paciente.cpf} />
                  <Info label="Nascimento" valor={paciente.dataNascimento ? new Date(paciente.dataNascimento).toLocaleDateString("pt-BR") : null} />
                  <Info label="RG" valor={paciente.rg} />
                  <Info label="Convênio" valor={paciente.convenio?.nome} />
                  <Info label="Status" valor={paciente.status} />
                  <Info label="Cadastrado em" valor={new Date(paciente.criadoEm).toLocaleDateString("pt-BR")} />
                </>
              )}
              {aba === "contato" && (
                <>
                  <Info label="Telefone" valor={paciente.telefone} />
                  <Info label="WhatsApp" valor={paciente.whatsapp} />
                  <Info label="Email" valor={paciente.email} />
                  <Info label="Contato emergencial" valor={paciente.contatoEmergencial} />
                  <Info label="Endereço" valor={paciente.endereco} />
                  <Info label="Complemento" valor={paciente.complemento} />
                  <Info label="CEP" valor={paciente.cep} />
                </>
              )}
              {aba === "anamnese" && (
                <>
                  <Info label="Alergias" valor={paciente.alergias} />
                  <Info label="Indicação" valor={paciente.indicacao} />
                  <Info label="Cuidados especiais" valor={paciente.observacoes} />
                </>
              )}
            </div>
          )}
        </form>
      )}

      {aba === "prontuario" &&
        (podeVerProntuario ? (
          <ProntuarioClinico pacienteId={atual.id} />
        ) : (
          <div className="aviso-vazio">Seu cargo não tem permissão para visualizar prontuário clínico.</div>
        ))}

      {aba === "financeiro" && <FinanceiroPaciente pacienteId={atual.id} />}

      {aba === "retornos" && (
        <div>
          <p style={{ fontSize: 14, color: "#475569", marginBottom: "1rem" }}>
            Atendimentos realizados deste paciente que podem gerar retornos.
          </p>
          {carregandoRetornos ? (
            <p>Carregando...</p>
          ) : retornos.length === 0 ? (
            <div className="aviso-vazio">Nenhum atendimento registrado para este paciente.</div>
          ) : (
            <div className="historico-cards">
              {retornos.map((a) => (
                <div className="card" key={a.id}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <b>{a.procedimento?.nome || "Atendimento"}</b>
                    <span className="status-ativo">Atendido</span>
                  </div>
                  <div style={{ fontSize: 13, color: "#475569", display: "grid", gap: 3 }}>
                    <span>📅 {new Date(a.dataHora).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</span>
                    <span>👨‍⚕️ {a.profissional?.nome}</span>
                    {a.sala && <span>🚪 {a.sala.nome}</span>}
                    {a.observacoes && <span>📝 {a.observacoes}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Info({ label, valor }: { label: string; valor?: string | null }) {
  return (
    <div>
      <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 14, marginTop: 2 }}>{valor || "-"}</div>
    </div>
  );
}
