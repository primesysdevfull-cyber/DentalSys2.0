import { Router } from "express";
import { asyncHandler, authMiddleware, requirePermissao } from "../../middleware/auth";
import { listarSalas, criarSala, atualizarSala, excluirSala } from "./salas.controller";

const router = Router();

router.use(authMiddleware);

router.get("/", asyncHandler(listarSalas));
router.post("/", requirePermissao("salas.gerenciar"), asyncHandler(criarSala));
router.put("/:id", requirePermissao("salas.gerenciar"), asyncHandler(atualizarSala));
router.delete("/:id", requirePermissao("salas.gerenciar"), asyncHandler(excluirSala));

export default router;
