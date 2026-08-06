import { Router } from "express";
import { asyncHandler, authMiddleware, requirePermissao } from "../../middleware/auth";
import { upload } from "../../config/upload";
import {
  obterOdontograma,
  atualizarOdontograma,
  resetarOdontograma,
  listarEvolucoes,
  criarEvolucao,
  excluirEvolucao,
  listarExames,
  criarExame,
  excluirExame,
  listarReceituarios,
  criarReceituario,
  excluirReceituario,
  listarTermos,
  criarTermo,
  assinarTermo,
  excluirTermo,
} from "./prontuario.controller";

const router = Router();

router.use(authMiddleware);

router.get("/:pacienteId/odontograma", asyncHandler(obterOdontograma));
router.put("/:pacienteId/odontograma", requirePermissao("prontuario.editar"), asyncHandler(atualizarOdontograma));
router.delete("/:pacienteId/odontograma", requirePermissao("prontuario.editar"), asyncHandler(resetarOdontograma));

router.get("/:pacienteId/evolucoes", asyncHandler(listarEvolucoes));
router.post("/:pacienteId/evolucoes", requirePermissao("prontuario.editar"), asyncHandler(criarEvolucao));
router.delete("/:pacienteId/evolucoes/:evolucaoId", requirePermissao("prontuario.editar"), asyncHandler(excluirEvolucao));

router.get("/:pacienteId/exames", asyncHandler(listarExames));
router.post("/:pacienteId/exames", requirePermissao("prontuario.editar"), upload.single("arquivo"), asyncHandler(criarExame));
router.delete("/:pacienteId/exames/:exameId", requirePermissao("prontuario.editar"), asyncHandler(excluirExame));

router.get("/:pacienteId/receituarios", asyncHandler(listarReceituarios));
router.post("/:pacienteId/receituarios", requirePermissao("prontuario.editar"), asyncHandler(criarReceituario));
router.delete("/:pacienteId/receituarios/:receituarioId", requirePermissao("prontuario.editar"), asyncHandler(excluirReceituario));

router.get("/:pacienteId/termos", asyncHandler(listarTermos));
router.post("/:pacienteId/termos", requirePermissao("prontuario.editar"), asyncHandler(criarTermo));
router.patch("/:pacienteId/termos/:termoId/assinar", requirePermissao("prontuario.editar"), asyncHandler(assinarTermo));
router.delete("/:pacienteId/termos/:termoId", requirePermissao("prontuario.editar"), asyncHandler(excluirTermo));

export default router;
