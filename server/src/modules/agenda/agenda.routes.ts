import { Router } from "express";
import { asyncHandler, authMiddleware, requirePermissao } from "../../middleware/auth";
import {
  listarAgenda,
  obterAgendamento,
  criarAgendamento,
  atualizarAgendamento,
  mudarStatus,
  enviarConfirmacao,
  bloquearHorario,
  marcarRetorno,
  historicoAtendimentos,
  excluirAgendamento,
} from "./agenda.controller";

const router = Router();

router.use(authMiddleware);

router.get("/", asyncHandler(listarAgenda));
router.get("/historico", asyncHandler(historicoAtendimentos));
router.post("/bloquear", requirePermissao("agenda.editar"), asyncHandler(bloquearHorario));
router.get("/:id", asyncHandler(obterAgendamento));
router.post("/", requirePermissao("agenda.criar"), asyncHandler(criarAgendamento));
router.put("/:id", requirePermissao("agenda.editar"), asyncHandler(atualizarAgendamento));
router.put("/:id/status", requirePermissao("agenda.atender"), asyncHandler(mudarStatus));
router.post("/:id/confirmar", requirePermissao("agenda.editar"), asyncHandler(enviarConfirmacao));
router.post("/:id/retorno", requirePermissao("agenda.criar"), asyncHandler(marcarRetorno));
router.delete("/:id", requirePermissao("agenda.excluir"), asyncHandler(excluirAgendamento));

export default router;
