import { useEffect, useRef, useState } from "react";

export interface OpcaoAutocomplete {
  id: string;
  label: string;
  sub?: string | null;
}

interface Props {
  valor: string;
  onChange: (id: string | null) => void;
  placeholder?: string;
  buscar: (termo: string) => Promise<OpcaoAutocomplete[]>;
  onDigitar?: (termo: string) => void;
  minCaracteres?: number;
  obrigatorio?: boolean;
  rotuloInicial?: string;
  todasOpcoes?: () => Promise<OpcaoAutocomplete[]>;
}

export default function Autocomplete({
  valor,
  onChange,
  placeholder = "Digite para buscar...",
  buscar,
  onDigitar,
  minCaracteres = 1,
  obrigatorio,
  rotuloInicial,
  todasOpcoes,
}: Props) {
  const [texto, setTexto] = useState("");
  const [opcoes, setOpcoes] = useState<OpcaoAutocomplete[]>([]);
  const [aberto, setAberto] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [opcaoSelecionada, setOpcaoSelecionada] = useState<OpcaoAutocomplete | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const focoIndex = useRef(-1);

  useEffect(() => {
    if (valor && opcaoSelecionada?.id === valor) return;
    if (valor && rotuloInicial) {
      setOpcaoSelecionada({ id: valor, label: rotuloInicial });
      setTexto(rotuloInicial);
      return;
    }
    setOpcaoSelecionada(null);
  }, [valor]);

  useEffect(() => {
    function fechar(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setAberto(false);
      }
    }
    document.addEventListener("mousedown", fechar);
    return () => document.removeEventListener("mousedown", fechar);
  }, []);

  useEffect(() => {
    if (!aberto) return;
    focoIndex.current = -1;
  }, [aberto]);

  function executarBusca(termo: string) {
    setTexto(termo);
    onDigitar?.(termo);
    if (!termo || termo.trim().length < minCaracteres) {
      if (todasOpcoes) {
        setCarregando(true);
        todasOpcoes()
          .then((res) => {
            setOpcoes(res);
            setAberto(true);
          })
          .finally(() => setCarregando(false));
      } else {
        setOpcoes([]);
      }
      return;
    }
    setCarregando(true);
    buscar(termo.trim())
      .then((res) => {
        setOpcoes(res);
        setAberto(true);
      })
      .finally(() => setCarregando(false));
  }

  function selecionar(opcao: OpcaoAutocomplete) {
    setOpcaoSelecionada(opcao);
    setTexto(opcao.label);
    setAberto(false);
    onChange(opcao.id);
  }

  function limpar() {
    setOpcaoSelecionada(null);
    setTexto("");
    setOpcoes([]);
    setAberto(false);
    onChange(null);
  }

  function navegar(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!opcoes.length) return;
      const dir = e.key === "ArrowDown" ? 1 : -1;
      const novo = focoIndex.current + dir;
      focoIndex.current = novo >= opcoes.length ? 0 : novo < 0 ? opcoes.length - 1 : novo;
      return;
    }
    if (e.key === "Enter") {
      if (focoIndex.current >= 0 && opcoes[focoIndex.current]) {
        e.preventDefault();
        selecionar(opcoes[focoIndex.current]);
      }
    }
  }

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <input
        required={obrigatorio}
        placeholder={placeholder}
        value={texto}
        onChange={(e) => {
          executarBusca(e.target.value);
          if (opcaoSelecionada && e.target.value !== opcaoSelecionada.label) {
            onChange(null);
          }
        }}
        onFocus={() => {
          if (opcoes.length) {
            setAberto(true);
            return;
          }
          if (!texto && todasOpcoes) {
            executarBusca("");
          }
        }}
        onKeyDown={navegar}
        style={{ width: "100%" }}
      />
      {opcaoSelecionada && (
        <button
          type="button"
          onClick={limpar}
          title="Limpar seleção"
          style={{
            position: "absolute",
            right: 8,
            top: "50%",
            transform: "translateY(-50%)",
            border: "none",
            background: "transparent",
            cursor: "pointer",
            color: "#94a3b8",
            fontSize: 16,
          }}
        >
          ✕
        </button>
      )}
      {aberto && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            background: "white",
            border: "2px solid #e2e8f0",
            borderRadius: 8,
            boxShadow: "0 8px 20px rgba(0,0,0,0.12)",
            maxHeight: 240,
            overflowY: "auto",
            zIndex: 50,
          }}
        >
          {carregando ? (
            <div style={{ padding: "0.6rem 1rem", color: "#64748b", fontSize: 13 }}>Buscando...</div>
          ) : opcoes.length === 0 ? (
            <div style={{ padding: "0.6rem 1rem", color: "#94a3b8", fontSize: 13 }}>Nenhum resultado encontrado</div>
          ) : (
            opcoes.map((o, i) => (
              <button
                key={o.id}
                type="button"
                onClick={() => selecionar(o)}
                onMouseEnter={() => (focoIndex.current = i)}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  border: "none",
                  background: focoIndex.current === i ? "#eff6ff" : "white",
                  padding: "0.55rem 1rem",
                  cursor: "pointer",
                  fontSize: 13,
                  color: "#1e293b",
                }}
              >
                <div style={{ fontWeight: 600 }}>{o.label}</div>
                {o.sub && <div style={{ fontSize: 12, color: "#64748b" }}>{o.sub}</div>}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
