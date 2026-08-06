import { Router } from "express";
import { asyncHandler, authMiddleware, requirePermissao } from "../../middleware/auth";
import { listarTemplates, salvarTemplate, excluirTemplate } from "./mensagens.controller";
import {
  executarDisparosAutomaticos,
  listarEnvios,
  obterConfigMensagem,
  salvarConfigMensagem,
} from "./enviador";

const router = Router();

router.use(authMiddleware);

router.get("/templates", asyncHandler(listarTemplates));
router.put("/templates", requirePermissao("mensagens.configurar"), asyncHandler(salvarTemplate));
router.delete("/templates/:id", requirePermissao("mensagens.configurar"), asyncHandler(excluirTemplate));

router.get("/config", asyncHandler(async (req, res) => {
  const { clinicaId } = req.auth!;
  const config = await obterConfigMensagem(clinicaId);
  res.json(config);
}));

router.put("/config", requirePermissao("mensagens.configurar"), asyncHandler(async (req, res) => {
  const { clinicaId } = req.auth!;
  const config = await salvarConfigMensagem(clinicaId, req.body);
  res.json(config);
}));

router.get("/envios", asyncHandler(async (req, res) => {
  const { clinicaId } = req.auth!;
  const tipo = req.query.tipo ? String(req.query.tipo) : undefined;
  const envios = await listarEnvios(clinicaId, tipo);
  res.json(envios);
}));

router.post("/disparar", requirePermissao("mensagens.configurar"), asyncHandler(async (_req, res) => {
  const resultado = await executarDisparosAutomaticos();
  res.json(resultado);
}));

export default router;