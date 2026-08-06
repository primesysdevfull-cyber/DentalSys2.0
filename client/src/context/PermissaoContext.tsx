import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { obterSessao, Sessao, usuarioLogado } from "../services/auth";

interface PermissaoContextValue {
  sessao: Sessao | null;
  permissoes: string[];
  temPermissao: (permissao: string) => boolean;
  carregando: boolean;
}

const PermissaoContext = createContext<PermissaoContextValue>({
  sessao: null,
  permissoes: [],
  temPermissao: () => false,
  carregando: true,
});

export function PermissaoProvider({ children }: { children: ReactNode }) {
  const [sessao, setSessao] = useState<Sessao | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (!usuarioLogado()) {
      setCarregando(false);
      return;
    }
    obterSessao()
      .then(setSessao)
      .catch(() => setSessao(null))
      .finally(() => setCarregando(false));
  }, []);

  const permissoes = sessao?.permissoes ?? [];
  const temPermissao = (p: string) => permissoes.includes(p);

  return (
    <PermissaoContext.Provider value={{ sessao, permissoes, temPermissao, carregando }}>
      {children}
    </PermissaoContext.Provider>
  );
}

export function usePermissao() {
  return useContext(PermissaoContext);
}
