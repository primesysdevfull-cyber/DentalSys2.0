export function mascaraCpf(valor: string): string {
  const digitos = valor.replace(/\D/g, "").slice(0, 11);
  return digitos
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/(\d{3})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3-$4");
}

export function mascaraCep(valor: string): string {
  const digitos = valor.replace(/\D/g, "").slice(0, 8);
  return digitos.replace(/(\d{5})(\d)/, "$1-$2");
}

export function formatarMoeda(valor: number): string {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });
}

export function mascaraMoeda(valor: string): string {
  const digitos = valor.replace(/\D/g, "").slice(0, 12);
  const numero = digitos.length ? parseInt(digitos, 10) : 0;
  return formatarMoeda(numero / 100);
}

export function parseMoeda(valor: string): number {
  const numerico = valor.replace(/[^\d,]/g, "").replace(/\./g, "").replace(",", ".");
  const numero = parseFloat(numerico);
  return isNaN(numero) ? 0 : numero;
}

export function mascaraTelefone(valor: string): string {
  const digitos = valor.replace(/\D/g, "").slice(0, 11);
  return digitos
    .replace(/(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d)/, "$1-$2")
    .slice(0, 15);
}

export function somenteDigitos(valor?: string | null): string {
  return (valor || "").replace(/\D/g, "");
}

export function linkWhatsApp(valor?: string | null): string | null {
  const digitos = somenteDigitos(valor);
  if (digitos.length === 0) return null;
  return `https://wa.me/55${digitos}`;
}

export interface EnderecoViaCep {
  cep: string;
  logradouro: string;
  bairro: string;
  localidade: string;
  uf: string;
  erro?: boolean;
}

export async function buscarCep(cep: string): Promise<EnderecoViaCep | null> {
  const digitos = cep.replace(/\D/g, "");
  if (digitos.length !== 8) return null;

  const resposta = await fetch(`https://viacep.com.br/ws/${digitos}/json/`);
  if (!resposta.ok) return null;

  const dados = await resposta.json();
  if (dados.erro) return null;
  return dados as EnderecoViaCep;
}
