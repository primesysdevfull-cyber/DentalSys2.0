import { executarDisparosAutomaticos } from "../modules/mensagens/enviador";

let intervalo: NodeJS.Timeout | null = null;

const INTERVALO_MS = Math.max(60_000, Number(process.env.MENSAGENS_INTERVALO_MIN ?? 5) * 60_000);

async function rodar() {
  try {
    const resumo = await executarDisparosAutomaticos();
    console.log(`[mensagens] disparo automático: lembretes=${resumo.lembretes} retornos=${resumo.retornos} aniversarios=${resumo.aniversarios}`);
  } catch (e) {
    console.error("[mensagens] erro no disparo automático:", (e as Error).message);
  }
}

export function iniciarAgendadorMensagens() {
  if (process.env.MENSAGENS_AUTOMATICAS === "false") {
    console.log("[mensagens] disparo automático desativado (MENSAGENS_AUTOMATICAS=false)");
    return;
  }
  rodar();
  intervalo = setInterval(rodar, INTERVALO_MS);
  console.log(`[mensagens] agendador iniciado (intervalo ${INTERVALO_MS / 60000}min)`);
}

export function pararAgendadorMensagens() {
  if (intervalo) {
    clearInterval(intervalo);
    intervalo = null;
  }
}
