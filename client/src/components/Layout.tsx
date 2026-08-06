import { useEffect, useState } from "react";
import { Link, useNavigate, useLocation, Outlet } from "react-router-dom";
import { logout, usuarioLogado } from "../services/auth";
import { usePermissao } from "../context/PermissaoContext";

interface ItemMenu {
  para: string;
  label: string;
}

interface GrupoMenu {
  titulo: string;
  itens: ItemMenu[];
}

function GrupoMenuRecolhivel({ grupo, pathname, aberto, onToggle }: {
  grupo: GrupoMenu;
  pathname: string;
  aberto: boolean;
  onToggle: () => void;
}) {
  const ativo = grupo.itens.some((i) => pathname.startsWith(i.para));

  return (
    <li>
      <button
        type="button"
        className={`sidebar-grupo-btn ${ativo ? "ativo" : ""}`}
        onClick={onToggle}
      >
        <span>{grupo.titulo}</span>
        <span className="sidebar-seta">{aberto ? "▾" : "▸"}</span>
      </button>
      {aberto && (
        <ul className="sidebar-submenu">
          {grupo.itens.map((i) => (
            <li key={i.para}>
              <Link to={i.para} className={pathname.startsWith(i.para) ? "ativo" : undefined}>
                {i.label}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

export default function Layout() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const usuario = usuarioLogado();
  const { temPermissao } = usePermissao();

  const grupos: GrupoMenu[] = [];

  if (temPermissao("dashboard.ver")) {
    grupos.push({
      titulo: "Início",
      itens: [{ para: "/dashboard", label: "Painel" }],
    });
  }

  grupos.push({
    titulo: "Cadastros",
    itens: [
      { para: "/pacientes", label: "Pacientes" },
      { para: "/profissionais", label: "Profissionais" },
      { para: "/procedimentos", label: "Procedimentos" },
      { para: "/convenios", label: "Convênios" },
      { para: "/configuracoes", label: "Configurações da Clínica" },
    ],
  });

  if (temPermissao("agenda.ver")) {
    grupos.push({
      titulo: "Agenda e Atendimentos",
      itens: [
        { para: "/agenda", label: "Agenda" },
        { para: "/agenda?modo=historico", label: "Histórico de Atendimentos" },
      ],
    });
  }

  if (temPermissao("prontuario.ver")) {
    grupos.push({
      titulo: "Prontuários",
      itens: [{ para: "/prontuarios", label: "Prontuários" }],
    });
  }

  if (temPermissao("financeiro.ver")) {
    grupos.push({
      titulo: "Financeiro",
      itens: [
        { para: "/financeiro", label: "Lançamentos e Comissões" },
        { para: "/notas-fiscais", label: "Notas Fiscais" },
      ],
    });
  }

  if (temPermissao("usuarios.gerenciar")) {
    grupos.push({
      titulo: "Administração",
      itens: [{ para: "/usuarios", label: "Usuários e Permissões" }],
    });
  }

  if (temPermissao("dashboard.ver")) {
    grupos.push({
      titulo: "Relatórios",
      itens: [
        { para: "/relatorios", label: "Relatórios" },
        { para: "/mensagens", label: "Mensagens" },
      ],
    });
  }

  const grupoAtivo = grupos.find((g) => g.itens.some((i) => pathname.startsWith(i.para)));
  const [abertos, setAbertos] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (grupoAtivo) {
      setAbertos((a) => ({ ...a, [grupoAtivo.titulo]: true }));
    }
  }, [pathname]);

  const toggleGrupo = (titulo: string) =>
    setAbertos((a) => ({ ...a, [titulo]: !a[titulo] }));

  return (
    <div className="painel-container">
      <aside className="sidebar">
        <div className="sidebar-logo">
          DentalSys <span>2.0</span>
        </div>

        <ul className="sidebar-menu">
          {grupos.map((g) => (
            <GrupoMenuRecolhivel
              key={g.titulo}
              grupo={g}
              pathname={pathname}
              aberto={!!abertos[g.titulo]}
              onToggle={() => toggleGrupo(g.titulo)}
            />
          ))}
        </ul>

        <div className="sidebar-sair">
          <div style={{ fontSize: 13, color: "#cbd5e1", marginBottom: 8 }}>
            {usuario?.nome} · <span style={{ color: "#93c5fd" }}>{usuario?.cargo}</span>
          </div>
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              logout();
              navigate("/login");
            }}
          >
            Sair
          </a>
        </div>
      </aside>

      <div className="conteudo-principal">
        <Outlet />
      </div>
    </div>
  );
}
