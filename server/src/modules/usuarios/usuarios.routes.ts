import { Router } from "express";
import { asyncHandler, authMiddleware, requirePermissao } from "../../middleware/auth";
import {
  listarUsuarios,
  criarUsuario,
  atualizarUsuario,
  alternarAtivo,
  me,
} from "./usuarios.controller";

const router = Router();

router.use(authMiddleware);

router.get("/me", me);
router.get("/", requirePermissao("usuarios.gerenciar"), asyncHandler(listarUsuarios));
router.post("/", requirePermissao("usuarios.gerenciar"), asyncHandler(criarUsuario));
router.put("/:id", requirePermissao("usuarios.gerenciar"), asyncHandler(atualizarUsuario));
router.patch("/:id/ativo", requirePermissao("usuarios.gerenciar"), asyncHandler(alternarAtivo));

export default router;
