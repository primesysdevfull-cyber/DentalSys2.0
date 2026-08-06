import path from "path";
import fs from "fs";
import multer from "multer";

export const uploadDir = path.resolve(process.cwd(), "uploads");
export const nfseCertDir = path.resolve(uploadDir, "nfse/certs");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
if (!fs.existsSync(nfseCertDir)) {
  fs.mkdirSync(nfseCertDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});

export const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const permitidos = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".pdf"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (permitidos.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Formato de arquivo não permitido"));
    }
  },
});

export const uploadCsv = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const permitidos = [".csv", ".txt"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (permitidos.includes(ext) || file.mimetype.includes("text/csv") || file.mimetype.includes("text/plain")) {
      cb(null, true);
    } else {
      cb(new Error("Apenas arquivos CSV são permitidos"));
    }
  },
});

export const uploadCertificado = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, nfseCertDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `a1-${Date.now()}.${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === ".pfx" || ext === ".p12" || file.mimetype.includes("pkcs12")) {
      cb(null, true);
    } else {
      cb(new Error("Envie um certificado digital no formato .pfx ou .p12"));
    }
  },
});
