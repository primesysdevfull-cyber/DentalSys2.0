import { Router } from "express";
import { asyncHandler, authMiddleware, requirePermissao } from "../../middleware/auth";
import { uploadCsv } from "../../config/upload";
import {
  listarPacientes,
  obterPaciente,
  criarPaciente,
  atualizarPaciente,
  excluirPaciente,
  adicionarProntuario,
  excluirProntuario,
  exportarPacientes,
  importarPacientes,
} from "./pacientes.controller";

const router = Router();

router.use(authMiddleware);

router.get("/exportar", asyncHandler(exportarPacientes));
router.post("/importar", requirePermissao("pacientes.criar"), uploadCsv.single("arquivo"), asyncHandler(importarPacientes));

router.get("/", asyncHandler(listarPacientes));
router.get("/:id", asyncHandler(obterPaciente));
router.post("/", requirePermissao("pacientes.criar"), asyncHandler(criarPaciente));
router.put("/:id", requirePermissao("pacientes.editar"), asyncHandler(atualizarPaciente));
router.delete("/:id", requirePermissao("pacientes.excluir"), asyncHandler(excluirPaciente));
router.post("/:id/prontuarios", requirePermissao("prontuario.editar"), asyncHandler(adicionarProntuario));
router.delete("/:id/prontuarios/:prontuarioId", requirePermissao("prontuario.editar"), asyncHandler(excluirProntuario));

export default router;
