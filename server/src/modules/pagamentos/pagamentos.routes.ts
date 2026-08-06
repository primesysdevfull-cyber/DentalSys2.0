import { Router } from "express";
import { asyncHandler, authMiddleware, requirePermissao } from "../../middleware/auth";
import {
  obterConfig,
  salvarConfig,
  criarCobranca,
  obterCobranca,
  marcarPago,
  webhookPagamento,
} from "./pagamentos.controller";

const router = Router();

router.post("/webhook", asyncHandler(webhookPagamento));

router.use(authMiddleware);

router.get("/", asyncHandler(obterConfig));
router.put("/config", requirePermissao("financeiro.baixar"), asyncHandler(salvarConfig));

router.post("/lancamentos/:id/cobranca", requirePermissao("financeiro.criar"), asyncHandler(criarCobranca));
router.get("/cobrancas/:id", asyncHandler(obterCobranca));
router.post("/cobrancas/:id/marcar-pago", requirePermissao("financeiro.baixar"), asyncHandler(marcarPago));

export default router;