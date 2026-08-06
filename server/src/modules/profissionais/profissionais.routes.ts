import { Router } from "express";
import { asyncHandler, authMiddleware, requirePermissao } from "../../middleware/auth";
import {
  listarProfissionais,
  criarProfissional,
  atualizarProfissional,
  excluirProfissional,
} from "./profissionais.controller";

const router = Router();

router.use(authMiddleware);

router.get("/", asyncHandler(listarProfissionais));
router.post("/", requirePermissao("profissionais.criar"), asyncHandler(criarProfissional));
router.put("/:id", requirePermissao("profissionais.editar"), asyncHandler(atualizarProfissional));
router.delete("/:id", requirePermissao("profissionais.excluir"), asyncHandler(excluirProfissional));

export default router;
