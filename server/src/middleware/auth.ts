import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { Cargo, temPermissao } from "../config/permissoes";

export interface AuthPayload {
  userId: string;
  clinicaId: string;
  email: string;
  cargo: Cargo;
}

export interface AuthRequest extends Request {
  auth?: AuthPayload;
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token não informado" });
  }

  const token = header.split(" ")[1];

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || "dev-secret") as AuthPayload;
    req.auth = payload;
    next();
  } catch {
    return res.status(401).json({ error: "Token inválido ou expirado" });
  }
}

export function requirePermissao(permissao: string) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const { cargo } = req.auth!;
    if (!temPermissao(cargo, permissao)) {
      return res.status(403).json({ error: "Sem permissão para esta ação" });
    }
    next();
  };
}

export function asyncHandler(
  fn: (req: AuthRequest, res: Response, next: NextFunction) => Promise<unknown>
) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof Error && "issues" in (err as any)) {
    return res.status(400).json({ error: "Dados inválidos", detalhes: (err as any).issues });
  }
  console.error(err);
  res.status(500).json({ error: "Erro interno do servidor" });
}
