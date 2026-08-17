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

// ======================= COBERTURA COMPLETA DOS MÓDULOS =======================
const suf = `${Date.now()}`;
let tokenDentista = "";
let tokenRecepcao = "";

beforeAll(async () => {
  const perfis: [string, (t: string) => void][] = [
    ["dr.carlos@dentalsys.com", (t) => (tokenDentista = t)],
    ["recepcao@dentalsys.com", (t) => (tokenRecepcao = t)],
  ];
  for (const [email, gravar] of perfis) {
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, senha: "admin123" }),
    });
    expect(res.status).toBe(200);
    const dados = (await res.json()) as { token: string };
    gravar(dados.token);
  }
});

function apiAs(tokenDoUsuario: string, method: string, caminho: string, corpo?: unknown) {
  return api(method, caminho, corpo, { Authorization: `Bearer ${tokenDoUsuario}` });
}

describe("Login por perfil", () => {
  it("dentista loga com cargo correto", async () => {
    const res = await apiAs(tokenDentista, "GET", "/api/usuarios/me");
    expect(res.status).toBe(200);
    const me = (await res.json()) as { cargo: string };
    expect(me.cargo).toBe("dentista");
  });

  it("recepcionista loga com cargo correto", async () => {
    const res = await apiAs(tokenRecepcao, "GET", "/api/usuarios/me");
    expect(res.status).toBe(200);
    const me = (await res.json()) as { cargo: string };
    expect(me.cargo).toBe("recepcionista");
  });
});

describe("Convênios: CRUD", () => {
  let id = "";

  it("cria convênio", async () => {
    const res = await api("POST", "/api/convenios", { nome: `Convênio Teste ${suf}` });
    expect(res.status).toBe(201);
    id = ((await res.json()) as { id: string }).id;
  });

  it("lista convênios", async () => {
    const res = await api("GET", "/api/convenios");
    expect(res.status).toBe(200);
    const lista = (await res.json()) as { nome: string }[];
    expect(lista.some((c) => c.nome === `Convênio Teste ${suf}`)).toBe(true);
  });

  it("atualiza convênio", async () => {
    const res = await api("PUT", `/api/convenios/${id}`, { telefone: "(11) 99999-0000" });
    expect(res.status).toBe(200);
  });

  it("recepcionista não pode criar convênio", async () => {
    const res = await apiAs(tokenRecepcao, "POST", "/api/convenios", { nome: "X" });
    expect(res.status).toBe(403);
  });

  it("exclui convênio", async () => {
    const res = await api("DELETE", `/api/convenios/${id}`);
    expect(res.status).toBe(204);
  });
});

describe("Procedimentos: CRUD + valor por convênio", () => {
  let id = "";
  let convenioId = "";

  it("cria procedimento", async () => {
    const res = await api("POST", "/api/procedimentos", {
      nome: `Limpeza Teste ${suf}`,
      valorParticular: 180,
      duracaoMedia: 40,
    });
    expect(res.status).toBe(201);
    id = ((await res.json()) as { id: string }).id;
  });

  it("define valor por convênio", async () => {
    const conv = await api("POST", "/api/convenios", { nome: `Convênio Proc ${suf}` });
    convenioId = ((await conv.json()) as { id: string }).id;
    const res = await api("PUT", `/api/procedimentos/${id}/convenios/valor`, {
      convenioId,
      valor: 120,
    });
    expect(res.status).toBe(200);
  });

  it("sugere valor por convênio no financeiro", async () => {
    const pacientes = (await (await api("GET", "/api/pacientes")).json()) as { id: string }[];
    const res = await api(
      "GET",
      `/api/financeiro/procedimentos/valor?procedimentoId=${id}&pacienteId=${pacientes[0].id}`
    );
    expect(res.status).toBe(200);
  });

  it("lista procedimentos", async () => {
    const res = await api("GET", `/api/procedimentos?busca=${encodeURIComponent(suf)}`);
    expect(res.status).toBe(200);
    const lista = (await res.json()) as { nome: string }[];
    expect(lista.some((p) => p.nome === `Limpeza Teste ${suf}`)).toBe(true);
  });

  it("exclui procedimento e convênio de apoio", async () => {
    const res = await api("DELETE", `/api/procedimentos/${id}`);
    expect(res.status).toBe(204);
    await api("DELETE", `/api/convenios/${convenioId}`);
  });
});

describe("Salas: CRUD", () => {
  let id = "";

  it("cria sala", async () => {
    const res = await api("POST", "/api/salas", { nome: `Sala Teste ${suf}` });
    expect(res.status).toBe(201);
    id = ((await res.json()) as { id: string }).id;
  });

  it("lista salas", async () => {
    const res = await api("GET", "/api/salas");
    expect(res.status).toBe(200);
    const lista = (await res.json()) as { nome: string }[];
    expect(lista.some((s) => s.nome === `Sala Teste ${suf}`)).toBe(true);
  });

  it("atualiza sala", async () => {
    const res = await api("PUT", `/api/salas/${id}`, { nome: `Sala Teste ${suf} B` });
    expect(res.status).toBe(200);
  });

  it("recepcionista não pode gerenciar salas", async () => {
    const res = await apiAs(tokenRecepcao, "POST", "/api/salas", { nome: "X" });
    expect(res.status).toBe(403);
  });

  it("exclui sala", async () => {
    const res = await api("DELETE", `/api/salas/${id}`);
    expect(res.status).toBe(204);
  });
});

describe("Profissionais: criação com usuário", () => {
  let id = "";

  it("cria profissional com comissão", async () => {
    const res = await api("POST", "/api/profissionais", {
      nome: `Dr. Teste ${suf}`,
      cro: `SP ${suf.slice(-5)}`,
      especialidade: "Clinica Geral",
      comissao: 30,
      email: `dr.teste${suf}@dentalsys.com`,
      senha: "senha123",
      cargo: "dentista",
    });
    expect(res.status).toBe(201);
    id = ((await res.json()) as { id: string }).id;
  });

  it("exige email do profissional", async () => {
    const res = await api("POST", "/api/profissionais", { nome: "Sem Email", cro: "SP 1" });
    expect(res.status).toBe(400);
  });

  it("recepcionista não pode criar profissional", async () => {
    const res = await apiAs(tokenRecepcao, "POST", "/api/profissionais", {});
    expect(res.status).toBe(403);
  });

  it("exclui profissional", async () => {
    const res = await api("DELETE", `/api/profissionais/${id}`);
    expect(res.status).toBe(204);
  });
});

describe("Prontuário: evolução, receituário, termo, odontograma, exame", () => {
  let pacienteId = "";
  let profissionalId = "";
  let termoId = "";
  let exameId = "";

  it("prepara paciente e profissional", async () => {
    const p = await api("POST", "/api/pacientes", {
      nome: `Paciente Prontuário ${suf}`,
      cpf: "111.222.333-44",
    });
    pacienteId = ((await p.json()) as { id: string }).id;
    const profs = (await (await api("GET", "/api/profissionais")).json()) as { id: string; nome: string }[];
    const drCarlos = profs.find((x) => x.nome === "Dr. Carlos Lima");
    expect(drCarlos).toBeTruthy();
    profissionalId = drCarlos!.id;
  });

  it("adiciona evolução clínica", async () => {
    const res = await api("POST", `/api/prontuario/${pacienteId}/evolucoes`, {
      profissionalId,
      descricao: "Paciente relata sensibilidade no dente 26",
      conduta: "Observação e retorno em 30 dias",
    });
    expect(res.status).toBe(201);
  });

  it("lista evoluções", async () => {
    const res = await api("GET", `/api/prontuario/${pacienteId}/evolucoes`);
    expect(res.status).toBe(200);
    const lista = (await res.json()) as { descricao: string }[];
    expect(lista.some((e) => e.descricao.includes("sensibilidade"))).toBe(true);
  });

  it("adiciona receituário", async () => {
    const res = await api("POST", `/api/prontuario/${pacienteId}/receituarios`, {
      profissionalId,
      medicamentos: [{ nome: "Amoxicilina 500mg", posologia: "8/8h por 7 dias", quantidade: "21 cápsulas" }],
    });
    expect(res.status).toBe(201);
  });

  it("cria termo de consentimento e assina", async () => {
    const res = await api("POST", `/api/prontuario/${pacienteId}/termos`, {
      titulo: `Termo Teste ${suf}`,
      conteudo: "Termo de consentimento para tratamento odontológico do paciente.",
      profissionalId,
    });
    expect(res.status).toBe(201);
    termoId = ((await res.json()) as { id: string }).id;

    const assinatura = await api("PATCH", `/api/prontuario/${pacienteId}/termos/${termoId}/assinar`, {});
    expect(assinatura.status).toBe(200);
    const termo = (await assinatura.json()) as { assinado: boolean; dataAssinatura: string | null };
    expect(termo.assinado).toBe(true);
    expect(termo.dataAssinatura).toBeTruthy();
  });

  it("atualiza e lê odontograma", async () => {
    const res = await api("PUT", `/api/prontuario/${pacienteId}/odontograma`, {
      numero: 11,
      condicao: "carie",
      observacao: "Cárie proximal",
    });
    expect(res.status).toBe(200);

    const lista = await api("GET", `/api/prontuario/${pacienteId}/odontograma`);
    expect(lista.status).toBe(200);
    const corpo = (await lista.json()) as { dentes: Record<string, { condicao: string }> };
    expect(corpo.dentes["11"]?.condicao).toBe("carie");
  });

  it("adiciona exame de imagem e lista", async () => {
    const form = new FormData();
    form.append("tipo", "imagem");
    form.append("descricao", "Raio-X panorâmico");
    form.append("arquivo", new Blob(["fakepng"], { type: "image/png" }), "rx.png");
    const res = await api("POST", `/api/prontuario/${pacienteId}/exames`, form);
    expect(res.status).toBe(201);
    exameId = ((await res.json()) as { id: string }).id;

    const lista = await api("GET", `/api/prontuario/${pacienteId}/exames`);
    expect(lista.status).toBe(200);
    const exames = (await lista.json()) as { id: string }[];
    expect(exames.some((e) => e.id === exameId)).toBe(true);
  });

  afterAll(async () => {
    if (pacienteId) await api("DELETE", `/api/pacientes/${pacienteId}`);
  });
});

describe("Agenda: fluxo completo", () => {
  let profissionalId = "";
  let pacienteId = "";
  let salaId = "";
  let agendamentoId = "";
  const dataBase = new Date(Date.now() + 5 * 86400000);
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  beforeAll(async () => {
    const res = await api(
      "GET",
      `/api/agenda?inicio=${fmt(dataBase)}&fim=${fmt(new Date(dataBase.getTime() + 10 * 86400000))}`,
    );
    if (res.status === 200) {
      const lista = (await res.json()) as { id: string }[];
      for (const a of lista) {
        await api("DELETE", `/api/agenda/${a.id}`).catch(() => {});
      }
    }
  });

  it("prepara dados de apoio", async () => {
    const profs = (await (await api("GET", "/api/profissionais")).json()) as { id: string; nome: string }[];
    profissionalId = profs.find((x) => x.nome === "Dr. Carlos Lima")!.id;
    const p = await api("POST", "/api/pacientes", { nome: `Paciente Agenda ${suf}`, cpf: "555.666.777-88" });
    pacienteId = ((await p.json()) as { id: string }).id;
    const s = await api("POST", "/api/salas", { nome: `Sala Agenda ${suf}` });
    salaId = ((await s.json()) as { id: string }).id;
  });

  it("cria agendamento confirmado", async () => {
    const res = await api("POST", "/api/agenda", {
      pacienteId,
      profissionalId,
      salaId,
      dataHora: new Date(`${fmt(dataBase)}T10:00:00-03:00`).toISOString(),
      duracaoMin: 40,
      status: "confirmado",
      observacoes: "Consulta de teste",
    });
    expect(res.status).toBe(201);
    agendamentoId = ((await res.json()) as { id: string }).id;
  });

  it("lista agenda no período", async () => {
    const res = await api("GET", `/api/agenda?inicio=${fmt(dataBase)}T00:00&fim=${fmt(dataBase)}T23:59`);
    expect(res.status).toBe(200);
    const lista = (await res.json()) as { id: string }[];
    expect(lista.some((a) => a.id === agendamentoId)).toBe(true);
  });

  it("rejeita conflito de horário", async () => {
    const res = await api("POST", "/api/agenda", {
      pacienteId,
      profissionalId,
      salaId,
      dataHora: new Date(`${fmt(dataBase)}T10:20:00-03:00`).toISOString(),
      duracaoMin: 40,
    });
    expect(res.status).toBe(409);
  });

  it("muda status para atendido", async () => {
    const res = await api("PUT", `/api/agenda/${agendamentoId}/status`, { status: "atendido" });
    expect(res.status).toBe(200);
    const a = (await res.json()) as { status: string };
    expect(a.status).toBe("atendido");
  });

  it("marca retorno vinculado", async () => {
    const res = await api("POST", `/api/agenda/${agendamentoId}/retorno`, {
      dataHora: new Date(`${fmt(new Date(dataBase.getTime() + 86400000))}T09:00:00-03:00`).toISOString(),
      profissionalId,
      salaId,
    });
    expect(res.status).toBe(201);
    const retorno = (await res.json()) as { ehRetorno: boolean; agendamentoOrigemId: string | null };
    expect(retorno.ehRetorno).toBe(true);
    expect(retorno.agendamentoOrigemId).toBe(agendamentoId);
  });

  it("bloqueia horário", async () => {
    const res = await api("POST", "/api/agenda/bloquear", {
      profissionalId,
      dataHora: new Date(`${fmt(new Date(dataBase.getTime() + 2 * 86400000))}T08:00:00-03:00`).toISOString(),
      duracaoMin: 60,
      status: "bloqueado",
    });
    expect(res.status).toBe(201);
  });

  it("recepcionista consegue criar agendamento", async () => {
    const res = await apiAs(tokenRecepcao, "POST", "/api/agenda", {
      pacienteId,
      profissionalId,
      salaId,
      dataHora: new Date(`${fmt(new Date(dataBase.getTime() + 3 * 86400000))}T15:00:00-03:00`).toISOString(),
      duracaoMin: 30,
    });
    expect(res.status).toBe(201);
  });

  afterAll(async () => {
    if (agendamentoId) await api("DELETE", `/api/agenda/${agendamentoId}`).catch(() => {});
    if (pacienteId) await api("DELETE", `/api/pacientes/${pacienteId}`).catch(() => {});
    if (salaId) await api("DELETE", `/api/salas/${salaId}`).catch(() => {});
  });
});

describe("Financeiro: lançamentos, comissão, baixar, cancelar", () => {
  let lancamentoId = "";
  let comissaoId = "";
  let pacienteId = "";
  let profissionalId = "";
  let procedimentoId = "";

  it("prepara dados de apoio", async () => {
    const p = await api("POST", "/api/pacientes", { nome: `Paciente Fin ${suf}`, cpf: "999.888.777-66" });
    pacienteId = ((await p.json()) as { id: string }).id;
    const pr = await api("POST", "/api/profissionais", {
      nome: `Dr. Fin ${suf}`,
      cro: `SP ${suf.slice(-5)}`,
      comissao: 30,
      email: `dr.fin${suf}@dentalsys.com`,
      senha: "senha123",
      cargo: "dentista",
    });
    profissionalId = ((await pr.json()) as { id: string }).id;
    const proc = await api("POST", "/api/procedimentos", { nome: `Proc Fin ${suf}`, valorParticular: 200 });
    procedimentoId = ((await proc.json()) as { id: string }).id;
  });

  it("cria lançamento com comissão automática", async () => {
    const res = await api("POST", "/api/financeiro/lancamentos", {
      tipo: "receita",
      descricao: `Tratamento Teste ${suf}`,
      valor: 200,
      formaPagamento: "pix",
      pacienteId,
      profissionalId,
      procedimentoId,
    });
    expect(res.status).toBe(201);
    lancamentoId = ((await res.json()) as { id: string }).id;
    expect(lancamentoId).toBeTruthy();
  });

  it("gera comissão de 30%", async () => {
    const res = await api("GET", "/api/financeiro/comissoes");
    expect(res.status).toBe(200);
    const comissoes = (await res.json()) as { id: string; valor: number; paga: boolean; lancamento: { id: string } }[];
    const minha = comissoes.find((c) => c.lancamento?.id === lancamentoId);
    expect(minha).toBeTruthy();
    expect(Number(minha!.valor)).toBe(60);
    comissaoId = minha!.id;
  });

  it("lista lançamentos", async () => {
    const res = await api("GET", `/api/financeiro/lancamentos?pacienteId=${pacienteId}`);
    expect(res.status).toBe(200);
    const lista = (await res.json()) as { id: string }[];
    expect(lista.some((l) => l.id === lancamentoId)).toBe(true);
  });

  it("baixa lançamento como recepcionista", async () => {
    const res = await apiAs(tokenRecepcao, "POST", `/api/financeiro/lancamentos/${lancamentoId}/baixar`, {});
    expect(res.status).toBe(200);
    const l = (await res.json()) as { status: string };
    expect(l.status).toBe("pago");
  });

  it("marca comissão como paga", async () => {
    const res = await api("POST", `/api/financeiro/comissoes/${comissaoId}/pagar`, {});
    expect(res.status).toBe(204);
  });

  it("recepcionista não pode pagar comissão", async () => {
    const res = await apiAs(tokenRecepcao, "POST", `/api/financeiro/comissoes/${comissaoId}/pagar`, {});
    expect(res.status).toBe(403);
  });

  it("cancela lançamento", async () => {
    const criado = await api("POST", "/api/financeiro/lancamentos", {
      tipo: "receita",
      descricao: `Tratamento Cancel ${suf}`,
      valor: 80,
      formaPagamento: "dinheiro",
      pacienteId,
    });
    expect(criado.status).toBe(201);
    const idCancelavel = ((await criado.json()) as { id: string }).id;

    const res = await api("POST", `/api/financeiro/lancamentos/${idCancelavel}/cancelar`, {});
    expect(res.status).toBe(204);
  });

  it("lançamento pago não pode ser cancelado", async () => {
    const res = await api("POST", `/api/financeiro/lancamentos/${lancamentoId}/cancelar`, {});
    expect(res.status).toBe(400);
    const erro = (await res.json()) as { error: string };
    expect(erro.error).toContain("pago");
  });

  it("recepcionista não pode cancelar lançamento", async () => {
    const res = await apiAs(tokenRecepcao, "POST", `/api/financeiro/lancamentos/${lancamentoId}/cancelar`, {});
    expect(res.status).toBe(403);
  });

  it("dentista não pode criar lançamento", async () => {
    const res = await apiAs(tokenDentista, "POST", "/api/financeiro/lancamentos", {
      tipo: "receita",
      descricao: "X",
      valor: 10,
    });
    expect(res.status).toBe(403);
  });

  afterAll(async () => {
    if (pacienteId) await api("DELETE", `/api/pacientes/${pacienteId}`);
    if (procedimentoId) await api("DELETE", `/api/procedimentos/${procedimentoId}`);
    if (profissionalId) await api("DELETE", `/api/profissionais/${profissionalId}`);
  });
});

describe("Caixa: abrir, consultar e fechar", () => {
  it("recepcionista não pode abrir caixa", async () => {
    const res = await apiAs(tokenRecepcao, "POST", "/api/financeiro/caixa/abrir", { dinheiroInicial: 0 });
    expect(res.status).toBe(403);
  });

  it("abre caixa", async () => {
    const res = await api("POST", "/api/financeiro/caixa/abrir", { dinheiroInicial: 100 });
    if (res.status === 400) {
      const c = await api("GET", "/api/financeiro/caixa");
      expect(c.status).toBe(200);
      return;
    }
    expect(res.status).toBe(201);
    const caixa = (await res.json()) as { situacao: string };
    expect(caixa.situacao).toBe("aberto");
  });

  it("consulta caixa do dia", async () => {
    const res = await api("GET", "/api/financeiro/caixa");
    expect(res.status).toBe(200);
  });

  it("fecha caixa registrando divergência", async () => {
    const res = await api("POST", "/api/financeiro/caixa/fechar", { valorInformado: 100 });
    if (res.status === 400) {
      const c = await api("GET", "/api/financeiro/caixa");
      expect(c.status).toBe(200);
      return;
    }
    expect(res.status).toBe(200);
    const caixa = (await res.json()) as { situacao: string; divergencia: number };
    expect(caixa.situacao).toBe("fechado");
    expect(typeof caixa.divergencia).toBe("number");
  });

  it("não permite reabrir no mesmo dia", async () => {
    const res = await api("POST", "/api/financeiro/caixa/abrir", { dinheiroInicial: 0 });
    expect(res.status).toBe(400);
  });
});

describe("Notas Fiscais: validações de vínculo", () => {
  let pacienteA = "";
  let pacienteB = "";
  let lancamentoA = "";
  let lancamentoB = "";
  let notaId = "";

  it("prepara dois pacientes com lançamentos", async () => {
    const a = await api("POST", "/api/pacientes", { nome: `Paciente NF A ${suf}`, cpf: "121.212.121-00" });
    pacienteA = ((await a.json()) as { id: string }).id;
    const b = await api("POST", "/api/pacientes", { nome: `Paciente NF B ${suf}`, cpf: "343.434.343-00" });
    pacienteB = ((await b.json()) as { id: string }).id;

    const la = await api("POST", "/api/financeiro/lancamentos", {
      tipo: "receita",
      descricao: `Lançamento A ${suf}`,
      valor: 150,
      pacienteId: pacienteA,
    });
    lancamentoA = ((await la.json()) as { id: string }).id;
    const lb = await api("POST", "/api/financeiro/lancamentos", {
      tipo: "receita",
      descricao: `Lançamento B ${suf}`,
      valor: 200,
      pacienteId: pacienteB,
    });
    lancamentoB = ((await lb.json()) as { id: string }).id;
  });

  it("rejeita nota com lançamento de outro paciente", async () => {
    const res = await api("POST", "/api/notas-fiscais", {
      pacienteId: pacienteA,
      lancamentoId: lancamentoB,
      tipo: "nfs_e",
      descricao: "Nota com vínculo errado",
      valor: 200,
      provedor: "proprio",
    });
    expect(res.status).toBe(400);
    const erro = (await res.json()) as { error: string };
    expect(erro.error).toContain("não pertence a este paciente");
  });

  it("cria nota vinculada ao lançamento correto", async () => {
    const res = await api("POST", "/api/notas-fiscais", {
      pacienteId: pacienteA,
      lancamentoId: lancamentoA,
      tipo: "nfs_e",
      descricao: `Nota correta ${suf}`,
      valor: 150,
      aliquota: 5,
      codigoServico: "85.03",
      provedor: "proprio",
    });
    expect(res.status).toBe(201);
    notaId = ((await res.json()) as { id: string }).id;
  });

  it("emite nota", async () => {
    const res = await api("POST", `/api/notas-fiscais/${notaId}/emitir`);
    expect(res.status).toBe(200);
    const nota = (await res.json()) as { status: string };
    expect(["loteEnviado", "autorizada", "rejeitada"]).toContain(nota.status);
  });

  it("cancelamento de rascunho funciona e de autorizada retorna erro", async () => {
    const nova = await api("POST", "/api/notas-fiscais", {
      pacienteId: pacienteA,
      tipo: "nfs_e",
      descricao: `Nota para cancelar ${suf}`,
      valor: 50,
      provedor: "proprio",
    });
    const novaId = ((await nova.json()) as { id: string }).id;
    const cancelada = await api("POST", `/api/notas-fiscais/${novaId}/cancelar`);
    expect(cancelada.status).toBe(200);
    expect(((await cancelada.json()) as { status: string }).status).toBe("cancelada");

    const reemitida = await api("POST", `/api/notas-fiscais/${novaId}/emitir`);
    expect(reemitida.status).toBe(400);
  });

  it("recepcionista não pode cancelar nota", async () => {
    const res = await apiAs(tokenRecepcao, "POST", `/api/notas-fiscais/${notaId}/cancelar`, {});
    expect(res.status).toBe(403);
  });

  afterAll(async () => {
    if (pacienteA) await api("DELETE", `/api/pacientes/${pacienteA}`);
    if (pacienteB) await api("DELETE", `/api/pacientes/${pacienteB}`);
  });
});

describe("Mensagens: configuração, templates e disparo", () => {
  it("lê configuração de mensagens", async () => {
    const res = await api("GET", "/api/mensagens/config");
    expect(res.status).toBe(200);
  });

  it("atualiza configuração", async () => {
    const res = await api("PUT", "/api/mensagens/config", { antecedenciaMin: 120 });
    expect(res.status).toBe(200);
    const config = (await res.json()) as { antecedenciaMin: number };
    expect(config.antecedenciaMin).toBe(120);
  });

  it("recepcionista não pode configurar mensagens", async () => {
    const res = await apiAs(tokenRecepcao, "PUT", "/api/mensagens/config", { antecedenciaMin: 60 });
    expect(res.status).toBe(403);
  });

  it("lista templates", async () => {
    const res = await api("GET", "/api/mensagens/templates");
    expect(res.status).toBe(200);
  });

  it("executa disparo automático", async () => {
    const res = await api("POST", "/api/mensagens/disparar", {});
    expect(res.status).toBe(200);
  });

  it("lista envios", async () => {
    const res = await api("GET", "/api/mensagens/envios");
    expect(res.status).toBe(200);
  });
});

describe("Dashboard: resumo e avisos", () => {
  it("retorna resumo do dashboard", async () => {
    const res = await api("GET", "/api/dashboard/resumo");
    expect(res.status).toBe(200);
    const dados = (await res.json()) as Record<string, unknown>;
    expect(Object.keys(dados).length).toBeGreaterThan(0);
  });

  it("retorna avisos", async () => {
    const res = await api("GET", "/api/dashboard/avisos");
    expect(res.status).toBe(200);
  });
});

describe("Pagamentos: configuração e cobrança", () => {
  let lancamentoId = "";
  let cobrancaId = "";

  it("salva configuração de pagamento", async () => {
    const res = await api("PUT", "/api/pagamentos/config", { ambiente: "sandbox", ativa: true });
    expect(res.status).toBe(200);
  });

  it("lê configuração de pagamento", async () => {
    const res = await api("GET", "/api/pagamentos");
    expect(res.status).toBe(200);
  });

  it("cria cobrança PIX para lançamento", async () => {
    const p = await api("POST", "/api/pacientes", { nome: `Paciente Cob ${suf}`, cpf: "565.656.565-00" });
    const pacienteId = ((await p.json()) as { id: string }).id;
    const l = await api("POST", "/api/financeiro/lancamentos", {
      tipo: "receita",
      descricao: `Cobrança ${suf}`,
      valor: 300,
      pacienteId,
    });
    lancamentoId = ((await l.json()) as { id: string }).id;

    const res = await api("POST", `/api/pagamentos/lancamentos/${lancamentoId}/cobranca`, {
      forma: "pix",
    });
    expect(res.status).toBe(201);
    cobrancaId = ((await res.json()) as { id: string }).id;

    const obtida = await api("GET", `/api/pagamentos/cobrancas/${cobrancaId}`);
    expect(obtida.status).toBe(200);
  });

  afterAll(async () => {
    if (lancamentoId) {
      const lista = await api("GET", `/api/pagamentos/cobrancas/${cobrancaId}`);
      if (lista.status === 200) await api("POST", `/api/pagamentos/cobrancas/${cobrancaId}/marcar-pago`, {});
    }
  });
});

describe("Usuários: gerenciamento", () => {
  let usuarioId = "";

  it("lista usuários", async () => {
    const res = await api("GET", "/api/usuarios");
    expect(res.status).toBe(200);
    const lista = (await res.json()) as { email: string }[];
    expect(lista.some((u) => u.email === "admin@dentalsys.com")).toBe(true);
  });

  it("cria usuário", async () => {
    const res = await api("POST", "/api/usuarios", {
      nome: `Usuário Teste ${suf}`,
      email: `usuario.teste${suf}@dentalsys.com`,
      senha: "senha123",
      cargo: "recepcionista",
    });
    expect(res.status).toBe(201);
    usuarioId = ((await res.json()) as { id: string }).id;
  });

  it("rejeita email duplicado", async () => {
    const res = await api("POST", "/api/usuarios", {
      nome: "Duplicado",
      email: "admin@dentalsys.com",
      senha: "senha123",
      cargo: "recepcionista",
    });
    expect(res.status).toBe(409);
    const erro = (await res.json()) as { error: string };
    expect(erro.error).toContain("cadastrado");
  });

  it("impede autodesativação", async () => {
    const me = (await (await api("GET", "/api/usuarios/me")).json()) as { id: string };
    const res = await api("PATCH", `/api/usuarios/${me.id}/ativo`, { ativo: false });
    expect(res.status).toBe(400);
  });

  it("desativa usuário e bloqueia login", async () => {
    const res = await api("PATCH", `/api/usuarios/${usuarioId}/ativo`, { ativo: false });
    expect(res.status).toBe(200);

    const login = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: `usuario.teste${suf}@dentalsys.com`, senha: "senha123" }),
    });
    expect(login.status).toBe(403);
  });

  it("recepcionista não pode criar usuário", async () => {
    const res = await apiAs(tokenRecepcao, "POST", "/api/usuarios", {});
    expect(res.status).toBe(403);
  });
});

describe("Permissões: negações 403", () => {
  it("dentista não cria profissional", async () => {
    const res = await apiAs(tokenDentista, "POST", "/api/profissionais", {});
    expect(res.status).toBe(403);
  });

  it("dentista não exclui paciente", async () => {
    const p = await api("POST", "/api/pacientes", { nome: `Paciente 403 ${suf}`, cpf: "777.888.999-00" });
    const id = ((await p.json()) as { id: string }).id;
    const res = await apiAs(tokenDentista, "DELETE", `/api/pacientes/${id}`);
    expect(res.status).toBe(403);
    await api("DELETE", `/api/pacientes/${id}`);
  });

  it("recepcionista não exclui paciente", async () => {
    const p = await api("POST", "/api/pacientes", { nome: `Paciente 403B ${suf}`, cpf: "888.999.000-11" });
    const id = ((await p.json()) as { id: string }).id;
    const res = await apiAs(tokenRecepcao, "DELETE", `/api/pacientes/${id}`);
    expect(res.status).toBe(403);
    await api("DELETE", `/api/pacientes/${id}`);
  });

  it("dentista não gerencia usuários", async () => {
    const res = await apiAs(tokenDentista, "POST", "/api/usuarios", {});
    expect(res.status).toBe(403);
  });
});

describe("Integridade referencial (P2003)", () => {
  it("bloqueia exclusão de profissional com vínculos", async () => {
    const profs = (await (await api("GET", "/api/profissionais")).json()) as { id: string; nome: string }[];
    const drCarlos = profs.find((x) => x.nome === "Dr. Carlos Lima");
    expect(drCarlos).toBeTruthy();

    const p = await api("POST", "/api/pacientes", { nome: `Paciente FK ${suf}`, cpf: "202.202.202-00" });
    const pacienteId = ((await p.json()) as { id: string }).id;

    const ag = await api("POST", "/api/agenda", {
      pacienteId,
      profissionalId: drCarlos!.id,
      dataHora: new Date(Date.now() + 9 * 86400000).toISOString(),
      duracaoMin: 30,
    });
    expect(ag.status).toBe(201);
    const agendamentoId = ((await ag.json()) as { id: string }).id;

    const res = await api("DELETE", `/api/profissionais/${drCarlos!.id}`);
    expect(res.status).toBe(409);
    const erro = (await res.json()) as { error: string };
    expect(erro.error).toContain("Operação bloqueada");

    await api("DELETE", `/api/agenda/${agendamentoId}`);
    await api("DELETE", `/api/pacientes/${pacienteId}`);
  });
});