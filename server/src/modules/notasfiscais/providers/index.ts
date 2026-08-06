import { NfProvider } from "./tipos";
import { ProvedorProprio } from "./proprio";
import { ProvedorTiny } from "./tiny";
import { ProvedorBling } from "./bling";

export function obterProvedor(nome: string): NfProvider {
  switch (nome) {
    case "tiny":
      return new ProvedorTiny();
    case "bling":
      return new ProvedorBling();
    default:
      return new ProvedorProprio();
  }
}