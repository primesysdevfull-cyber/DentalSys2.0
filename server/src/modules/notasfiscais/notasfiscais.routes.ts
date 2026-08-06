import { Router } from "express";
import { asyncHandler, authMiddleware, requirePermissao } from "../../middleware/auth";
import { uploadCertificado } from "../../config/upload";
import {
  listarNotas,
  criarNota,
  emitirNota,
  cancelarNota,
  obterIntegracoes,
  salvarIntegracao,
  obterConfigNfse,
  salvarConfigNfse,
  uploadCertificadoNfse,
} from "./notasfiscais.controller";

const router = Router();

router.use(authMiddleware);

router.get("/", asyncHandler(listarNotas));
router.post("/", requirePermissao("financeiro.criar"), asyncHandler(criarNota));
router.post("/:id/emitir", requirePermissao("financeiro.criar"), asyncHandler(emitirNota));
router.post("/:id/cancelar", requirePermissao("financeiro.excluir"), asyncHandler(cancelarNota));

router.get("/config/nfse", asyncHandler(obterConfigNfse));
router.put("/config/nfse", requirePermissao("financeiro.criar"), asyncHandler(salvarConfigNfse));
router.post(
  "/config/nfse/certificado",
  requirePermissao("financeiro.criar"),
  uploadCertificado.single("certificado"),
  asyncHandler(uploadCertificadoNfse)
);

router.get("/integracoes", asyncHandler(obterIntegracoes));
router.put("/integracoes", requirePermissao("financeiro.criar"), asyncHandler(salvarIntegracao));

export default router;