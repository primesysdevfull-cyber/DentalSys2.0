import { Router } from "express";
import { asyncHandler } from "../../middleware/auth";
import { login, registrar } from "./auth.controller";

const router = Router();

router.post("/login", asyncHandler(login));
router.post("/registro", asyncHandler(registrar));

export default router;
