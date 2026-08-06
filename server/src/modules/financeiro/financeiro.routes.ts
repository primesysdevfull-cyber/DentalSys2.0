import { Router } from "express";
import { asyncHandler, authMiddleware, requirePermissao } from "../../middleware/auth";
import {
  listarLancamentos,
  criarLancamento,
  atualizarLancamento,
  baixarLancamento,
  cancelarLancamento,
  excluirLancamento,
  resumoFinanceiro,
  listarComissoes,
  marcarComissaoPaga,
  sugerirValorProcedimento,
} from "./financeiro.controller";
import { abrirCaixa, fecharCaixa, listarHistoricoCaixa, obterCaixa } from "./caixa.controller";

const router = Router();

router.use(authMiddleware);

router.get("/lancamentos", asyncHandler(listarLancamentos));
router.get("/resumo", asyncHandler(resumoFinanceiro));
router.get("/procedimentos/valor", asyncHandler(sugerirValorProcedimento));
router.post("/lancamentos", requirePermissao("financeiro.criar"), asyncHandler(criarLancamento));
router.put("/lancamentos/:id", requirePermissao("financeiro.criar"), asyncHandler(atualizarLancamento));
router.post("/lancamentos/:id/baixar", requirePermissao("financeiro.baixar"), asyncHandler(baixarLancamento));
router.post("/lancamentos/:id/cancelar", requirePermissao("financeiro.excluir"), asyncHandler(cancelarLancamento));
router.delete("/lancamentos/:id", requirePermissao("financeiro.excluir"), asyncHandler(excluirLancamento));

router.get("/comissoes", asyncHandler(listarComissoes));
router.post("/comissoes/:id/pagar", requirePermissao("financeiro.comissoes"), asyncHandler(marcarComissaoPaga));

router.get("/caixa", asyncHandler(obterCaixa));
router.get("/caixa/historico", asyncHandler(listarHistoricoCaixa));
router.post("/caixa/abrir", requirePermissao("financeiro.caixa"), asyncHandler(abrirCaixa));
router.post("/caixa/fechar", requirePermissao("financeiro.caixa"), asyncHandler(fecharCaixa));

export default router;
