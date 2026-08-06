import { Router } from "express";
import { asyncHandler, authMiddleware, requirePermissao } from "../../middleware/auth";
import { obterClinica, atualizarClinica } from "./clinica.controller";

const router = Router();

router.use(authMiddleware);

router.get("/", asyncHandler(obterClinica));
router.put("/", requirePermissao("config.editar"), asyncHandler(atualizarClinica));

export default router;
