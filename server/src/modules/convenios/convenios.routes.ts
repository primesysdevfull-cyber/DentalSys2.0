import { Router } from "express";
import { asyncHandler, authMiddleware, requirePermissao } from "../../middleware/auth";
import {
  listarConvenios,
  criarConvenio,
  atualizarConvenio,
  excluirConvenio,
} from "./convenios.controller";

const router = Router();

router.use(authMiddleware);

router.get("/", asyncHandler(listarConvenios));
router.post("/", requirePermissao("convenios.criar"), asyncHandler(criarConvenio));
router.put("/:id", requirePermissao("convenios.editar"), asyncHandler(atualizarConvenio));
router.delete("/:id", requirePermissao("convenios.excluir"), asyncHandler(excluirConvenio));

export default router;
