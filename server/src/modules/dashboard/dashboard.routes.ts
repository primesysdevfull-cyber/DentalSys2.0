import { Router } from "express";
import { asyncHandler, authMiddleware } from "../../middleware/auth";
import { resumoDashboard, listarPendentesConfirmacao, relatorioAgenda, relatorioCompleto, avisosDashboard, resumoDoDia } from "./dashboard.controller";

const router = Router();

router.use(authMiddleware);

router.get("/resumo", asyncHandler(resumoDashboard));
router.get("/avisos", asyncHandler(avisosDashboard));
router.get("/dia", asyncHandler(resumoDoDia));
router.get("/pendentes-confirmacao", asyncHandler(listarPendentesConfirmacao));
router.get("/relatorio-agenda", asyncHandler(relatorioAgenda));
router.get("/relatorio-completo", asyncHandler(relatorioCompleto));

export default router;