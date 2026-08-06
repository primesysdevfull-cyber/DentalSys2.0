export function baixarCsv(nomeArquivo: string, cabecalho: string[], linhas: (string | number | null | undefined)[][]) {
  const escapar = (v: string | number | null | undefined) => {
    const s = v === null || v === undefined ? "" : String(v);
    if (/[";\n]/.test(s)) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const conteudo = [cabecalho, ...linhas]
    .map((linha) => linha.map(escapar).join(";"))
    .join("\r\n");

  const blob = new Blob(["\uFEFF" + conteudo], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${nomeArquivo}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}