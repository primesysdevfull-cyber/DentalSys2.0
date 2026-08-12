import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { login, registrar } from "../services/auth";

type Modo = "login" | "registro";

export default function Login() {
  const navigate = useNavigate();
  const [modo, setModo] = useState<Modo>("login");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [form, setForm] = useState({
    email: "",
    senha: "",
    clinicaNome: "",
    cnpj: "",
    clinicaEmail: "",
    usuarioNome: "",
  });

  const atualizar = (campo: string, valor: string) =>
    setForm((f) => ({ ...f, [campo]: valor }));

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErro("");
    setCarregando(true);
    try {
      if (modo === "login") {
        await login(form.email, form.senha);
      } else {
        await registrar({
          clinicaNome: form.clinicaNome,
          cnpj: form.cnpj,
          clinicaEmail: form.clinicaEmail,
          usuarioNome: form.usuarioNome,
          usuarioEmail: form.email,
          senha: form.senha,
        });
      }
      navigate("/dashboard");
    } catch (err: any) {
      setErro(err.response?.data?.error || "Falha na autenticação");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div
      className="login-container"
      style={{
        ["--login-bg-url" as any]: `url('${import.meta.env.VITE_LOGIN_BG ?? "/assets/login-bg.svg"}')`,
      } as React.CSSProperties}
    >
      <form className="login-box" onSubmit={enviar}>
        <h1>DentalSys 2.0</h1>
        <p>
          {modo === "login"
            ? "Acesse sua clínica"
            : "Crie sua clínica e usuário administrador"}
        </p>

        {erro && <div className="erro-msg">{erro}</div>}

        {modo === "registro" && (
          <>
            <div className="grid-2">
              <div className="form-group">
                <label>Nome da clínica</label>
                <input required value={form.clinicaNome} onChange={(e) => atualizar("clinicaNome", e.target.value)} />
              </div>
              <div className="form-group">
                <label>CNPJ</label>
                <input required value={form.cnpj} onChange={(e) => atualizar("cnpj", e.target.value)} />
              </div>
            </div>
            <div className="form-group">
              <label>Email da clínica</label>
              <input required type="email" value={form.clinicaEmail} onChange={(e) => atualizar("clinicaEmail", e.target.value)} />
            </div>
            <div className="form-group">
              <label>Seu nome</label>
              <input required value={form.usuarioNome} onChange={(e) => atualizar("usuarioNome", e.target.value)} />
            </div>
          </>
        )}

        <div className="form-group">
          <label>Email do usuário</label>
          <input required type="email" value={form.email} onChange={(e) => atualizar("email", e.target.value)} />
        </div>
        <div className="form-group">
          <label>Senha</label>
          <input required type="password" minLength={6} value={form.senha} onChange={(e) => atualizar("senha", e.target.value)} />
        </div>

        <button className="btn-entrar" disabled={carregando}>
          {carregando ? "Aguarde..." : modo === "login" ? "Entrar" : "Criar conta"}
        </button>

        <div className="link-cadastro">
          {modo === "login" ? "Ainda não tem conta? " : "Já tem conta? "}
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              setModo(modo === "login" ? "registro" : "login");
              setErro("");
            }}
          >
            {modo === "login" ? "Cadastre sua clínica" : "Entrar"}
          </a>
        </div>
      </form>
    </div>
  );
}
