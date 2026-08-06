import { afterAll, beforeAll, describe, expect, it } from "vitest";

const BASE = process.env.API_URL || "http://localhost:3333";

let token = "";

beforeAll(async () => {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@dentalsys.com", senha: "admin123" }),
  });
  expect(res.status).toBe(200);
  const dados = (await res.json()) as { token: string };
  token = dados.token;
});

async function api(method: string, caminho: string, corpo?: unknown, extraHeaders?: Record<string, string>) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    ...(corpo instanceof FormData ? {} : { "Content-Type": "application/json" }),
    ...extraHeaders,
  };
  const res = await fetch(`${BASE}${caminho}`, {
    method,
    headers,
    body: corpo instanceof FormData ? corpo : corpo ? JSON.stringify(corpo) : undefined,
  });
  return res;
}

describe("Auth", () => {
  it("rejeita login com senha errada", async () => {
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@dentalsys.com", senha: "errada" }),
    });
    expect(res.status).toBe(401);
  });

  it("exige token nas rotas protegidas", async () => {
    const res = await fetch(`${BASE}/api/pacientes`);
    expect(res.status).toBe(401);
  });
});

describe("Pacientes: exportar CSV", () => {
  it("retorna CSV com cabeçalho e BOM", async () => {
    const res = await api("GET", "/api/pacientes/exportar");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    const texto = await res.text();
    expect(texto).toContain("nome;dataNascimento;cpf");
    const bytes = await (await api("GET", "/api/pacientes/exportar")).arrayBuffer();
    const seq = new Uint8Array(bytes).slice(0, 3);
    expect(Array.from(seq)).toEqual([0xef, 0xbb, 0xbf]);
  });
});

describe("Pacientes: importar CSV", () => {
  const sufixo = `${Date.now()}`;
  const nomeNovo = `Teste Import ${sufixo}`;

  it("importa novo paciente e pula duplicados", async () => {
    const csv = `nome;dataNascimento;cpf;telefone;email;status
${nomeNovo};15/03/1990;${(98765432100 + Number(sufixo.slice(-3))).toString().padStart(11, "0").replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")};(11) 90000-1111;teste${sufixo}@x.com;ativo
João da Silva;10/10/1990;123.456.789-00;;;ativo
;01/01/2000;;;;ativo
`;
    const form = new FormData();
    form.append("arquivo", new Blob([`\uFEFF${csv}`], { type: "text/csv" }), "pacientes.csv");
    const res = await api("POST", "/api/pacientes/importar", form);
    expect(res.status).toBe(201);
    const resultado = (await res.json()) as {
      importados: number;
      erros: { linha: number; erro: string }[];
      pulados: { cpfDuplicado: number; semNome: number };
    };
    expect(resultado.importados).toBe(1);
    expect(resultado.pulados.cpfDuplicado).toBe(1);
    expect(resultado.pulados.semNome).toBe(1);
  });

  afterAll(async () => {
    const lista = await api("GET", `/api/pacientes`);
    const pacientes = (await lista.json()) as { id: string; nome: string }[];
    for (const p of pacientes.filter((p) => p.nome.startsWith("Teste Import"))) {
      await api("DELETE", `/api/pacientes/${p.id}`);
    }
  });
});

describe("Pacientes: CRUD", () => {
  const sufixo = `${Date.now()}`;
  const nome = `CRUD Teste ${sufixo}`;
  let id = "";

  it("cria paciente", async () => {
    const res = await api("POST", "/api/pacientes", {
      nome,
      cpf: "000.000.000-00",
      telefone: "(11) 91111-2222",
    });
    expect(res.status).toBe(201);
    const p = (await res.json()) as { id: string };
    id = p.id;
    expect(id).toBeTruthy();
  });

  it("lista o paciente criado", async () => {
    const res = await api("GET", "/api/pacientes");
    const lista = (await res.json()) as { nome: string }[];
    expect(lista.some((p) => p.nome === nome)).toBe(true);
  });

  it("busca por termo", async () => {
    const res = await api("GET", `/api/pacientes?busca=${encodeURIComponent(sufixo)}`);
    const lista = (await res.json()) as { nome: string }[];
    expect(lista.some((p) => p.nome === nome)).toBe(true);
  });

  it("atualiza paciente", async () => {
    const res = await api("PUT", `/api/pacientes/${id}`, { observacoes: "atualizado" });
    expect(res.status).toBe(200);
    const p = (await res.json()) as { observacoes: string };
    expect(p.observacoes).toBe("atualizado");
  });

  it("rejeita criar paciente com nome vazio", async () => {
    const res = await api("POST", "/api/pacientes", { nome: " " });
    expect(res.status).toBe(400);
  });

  it("exclui paciente", async () => {
    const res = await api("DELETE", `/api/pacientes/${id}`);
    expect(res.status).toBe(204);
    const lista = await api("GET", "/api/pacientes");
    const pacientes = (await lista.json()) as { id: string }[];
    expect(pacientes.some((p) => p.id === id)).toBe(false);
  });
});

describe("Financeiro", () => {
  it("retorna resumo financeiro", async () => {
    const res = await api("GET", "/api/financeiro/resumo");
    expect(res.status).toBe(200);
    const resumo = (await res.json()) as Record<string, unknown>;
    expect(resumo).toHaveProperty("totalRecebido");
  });
});

describe("Agenda", () => {
  it("lista agenda do dia", async () => {
    const hoje = new Date().toISOString();
    const res = await api("GET", `/api/agenda?inicio=${encodeURIComponent(hoje)}&fim=${encodeURIComponent(hoje)}`);
    expect(res.status).toBe(200);
  });
});

describe("Notas Fiscais", () => {
  const sufixo = `${Date.now()}`;
  let notaId = "";

  it("cria nota fiscal em rascunho", async () => {
    const lista = await api("GET", "/api/pacientes");
    const pacientes = (await lista.json()) as { id: string; nome: string }[];
    expect(pacientes.length).toBeGreaterThan(0);

    const res = await api("POST", "/api/notas-fiscais", {
      pacienteId: pacientes[0].id,
      tipo: "nfs_e",
      descricao: `Nota teste ${sufixo}`,
      valor: 150,
      aliquota: 5,
      codigoServico: "85.03",
      provedor: "proprio",
    });
    expect(res.status).toBe(201);
    const nota = (await res.json()) as { id: string; numero: number; status: string };
    notaId = nota.id;
    expect(nota.status).toBe("rascunho");
    expect(nota.numero).toBeGreaterThan(0);
  });

  it("emite nota via emissor próprio", async () => {
    expect(notaId).toBeTruthy();
    const res = await api("POST", `/api/notas-fiscais/${notaId}/emitir`);
    expect(res.status).toBe(200);
    const nota = (await res.json()) as { status: string; result: { status: string } };
    expect(["loteEnviado", "autorizada", "rejeitada"]).toContain(nota.status);
    expect(nota.result.status).toBe(nota.status);
  });

  it("bloqueia reemissão de nota não-rascunho", async () => {
    expect(notaId).toBeTruthy();
    const res = await api("POST", `/api/notas-fiscais/${notaId}/emitir`);
    const nota = (await res.json()) as { status: string };
    if (nota.status === "rascunho") return;
    expect(res.status).toBe(400);
  });

  it("rejeita nota sem paciente", async () => {
    const res = await api("POST", "/api/notas-fiscais", { descricao: "Sem paciente", valor: 10 });
    expect(res.status).toBe(400);
  });

  it("lista notas fiscais", async () => {
    const res = await api("GET", "/api/notas-fiscais");
    expect(res.status).toBe(200);
    const notas = (await res.json()) as { id: string }[];
    expect(notas.length).toBeGreaterThan(0);
  });
});

describe("Config NFS-e (emissor próprio)", () => {
  it("salva configuração do emissor próprio por clínica", async () => {
    const res = await api("PUT", "/api/notas-fiscais/config/nfse", {
      municipio: "Teste",
      uf: "GO",
      ambiente: "homologacao",
      ativa: true,
    });
    expect(res.status).toBe(200);
    const config = (await res.json()) as { ativa: boolean; certPath: unknown };
    expect(config.ativa).toBe(true);
    expect(config.certPath).toBeUndefined();
  });

  it("oculta dados sensíveis do certificado ao ler a config", async () => {
    const res = await api("GET", "/api/notas-fiscais/config/nfse");
    expect(res.status).toBe(200);
    const config = (await res.json()) as { ativa: boolean; certPassword: unknown };
    expect(config.ativa).toBe(true);
    expect(config.certPassword).toBeUndefined();
  });
});