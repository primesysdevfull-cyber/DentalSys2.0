import { Router } from "express";
import { asyncHandler, authMiddleware, requirePermissao } from "../../middleware/auth";
import {
  listarProcedimentos,
  obterProcedimento,
  criarProcedimento,
  atualizarProcedimento,
  excluirProcedimento,
  definirValorConvenio,
} from "./procedimentos.controller";

const router = Router();

router.use(authMiddleware);

router.get("/", asyncHandler(listarProcedimentos));
router.get("/:id", asyncHandler(obterProcedimento));
router.post("/", requirePermissao("procedimentos.criar"), asyncHandler(criarProcedimento));
router.put("/:id", requirePermissao("procedimentos.editar"), asyncHandler(atualizarProcedimento));
router.delete("/:id", requirePermissao("procedimentos.excluir"), asyncHandler(excluirProcedimento));
router.put("/:id/convenios/valor", requirePermissao("procedimentos.editar"), asyncHandler(definirValorConvenio));

export default router;
