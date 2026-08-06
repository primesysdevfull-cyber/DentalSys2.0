export function escaparCsv(valor: string | null | undefined): string {
  const s = valor === null || valor === undefined ? "" : String(valor);
  if (/[";\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function gerarCsv(cabecalho: string[], linhas: (string | null | undefined)[][]): string {
  const linhasCsv = [cabecalho, ...linhas]
    .map((linha) => linha.map(escaparCsv).join(";"))
    .join("\r\n");
  return "\uFEFF" + linhasCsv;
}

function parseLinhaCsv(linha: string): string[] {
  const campos: string[] = [];
  let atual = "";
  let dentroAspas = false;
  let i = 0;

  while (i < linha.length) {
    const c = linha[i];
    if (dentroAspas) {
      if (c === '"') {
        if (linha[i + 1] === '"') {
          atual += '"';
          i += 2;
          continue;
        }
        dentroAspas = false;
        i++;
        continue;
      }
      atual += c;
      i++;
      continue;
    }

    if (c === '"') {
      dentroAspas = true;
      i++;
      continue;
    }
    if (c === ";") {
      campos.push(atual);
      atual = "";
      i++;
      continue;
    }
    atual += c;
    i++;
  }
  campos.push(atual);
  return campos.map((c) => c.trim());
}

export function parseCsv(conteudo: string): Record<string, string>[] {
  const texto = conteudo.replace(/^\uFEFF/, "").replace(/\r/g, "");
  const linhas = texto
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (linhas.length === 0) return [];

  const cabecalho = parseLinhaCsv(linhas[0]).map((h) => h.toLowerCase().replace(/\s+/g, ""));

  return linhas.slice(1).map((linha) => {
    const valores = parseLinhaCsv(linha);
    const registro: Record<string, string> = {};
    cabecalho.forEach((h, i) => {
      registro[h] = valores[i] ?? "";
    });
    return registro;
  });
}