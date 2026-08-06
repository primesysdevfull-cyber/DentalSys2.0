import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ReactNode } from "react";
import Login from "./pages/Login";
import Layout from "./components/Layout";
import Pacientes from "./pages/Pacientes";
import PacienteDetalhe from "./pages/PacienteDetalhe";
import Profissionais from "./pages/Profissionais";
import Procedimentos from "./pages/Procedimentos";
import Convenios from "./pages/Convenios";
import Configuracoes from "./pages/Configuracoes";
import Usuarios from "./pages/Usuarios";
import Agenda from "./pages/Agenda";
import Financeiro from "./pages/Financeiro";
import Dashboard from "./pages/Dashboard";
import Relatorios from "./pages/Relatorios";
import Mensagens from "./pages/Mensagens";
import NotasFiscais from "./pages/NotasFiscais";
import ProntuarioIndex from "./pages/ProntuarioIndex";
import { PermissaoProvider } from "./context/PermissaoContext";
import { usuarioLogado } from "./services/auth";

function Protegido({ children }: { children: ReactNode }) {
  if (!usuarioLogado()) {
    return <Navigate to="/login" replace />;
  }
  return <PermissaoProvider>{children}</PermissaoProvider>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          element={
            <Protegido>
              <Layout />
            </Protegido>
          }
        >
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/relatorios" element={<Relatorios />} />
          <Route path="/mensagens" element={<Mensagens />} />
          <Route path="/prontuarios" element={<ProntuarioIndex />} />
          <Route path="/pacientes" element={<Pacientes />} />
          <Route path="/pacientes/:id" element={<PacienteDetalhe />} />
          <Route path="/profissionais" element={<Profissionais />} />
          <Route path="/procedimentos" element={<Procedimentos />} />
          <Route path="/convenios" element={<Convenios />} />
          <Route path="/configuracoes" element={<Configuracoes />} />
          <Route path="/usuarios" element={<Usuarios />} />
          <Route path="/agenda" element={<Agenda />} />
          <Route path="/financeiro" element={<Financeiro />} />
          <Route path="/notas-fiscais" element={<NotasFiscais />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
