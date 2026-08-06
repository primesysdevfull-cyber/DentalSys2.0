import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import authRoutes from "./modules/auth/auth.routes";
import pacientesRoutes from "./modules/pacientes/pacientes.routes";
import profissionaisRoutes from "./modules/profissionais/profissionais.routes";
import procedimentosRoutes from "./modules/procedimentos/procedimentos.routes";
import conveniosRoutes from "./modules/convenios/convenios.routes";
import clinicaRoutes from "./modules/clinica/clinica.routes";
import usuariosRoutes from "./modules/usuarios/usuarios.routes";
import agendaRoutes from "./modules/agenda/agenda.routes";
import salasRoutes from "./modules/salas/salas.routes";
import prontuarioRoutes from "./modules/prontuario/prontuario.routes";
import financeiroRoutes from "./modules/financeiro/financeiro.routes";
import dashboardRoutes from "./modules/dashboard/dashboard.routes";
import notasfiscaisRoutes from "./modules/notasfiscais/notasfiscais.routes";
import mensagensRoutes from "./modules/mensagens/mensagens.routes";
import pagamentosRoutes from "./modules/pagamentos/pagamentos.routes";
import { errorHandler } from "./middleware/auth";
import { uploadDir } from "./config/upload";
import { iniciarAgendadorMensagens } from "./config/agendadorMensagens";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => res.json({ status: "ok" }));
app.use("/api/auth", authRoutes);
app.use("/api/pacientes", pacientesRoutes);
app.use("/api/profissionais", profissionaisRoutes);
app.use("/api/procedimentos", procedimentosRoutes);
app.use("/api/convenios", conveniosRoutes);
app.use("/api/clinica", clinicaRoutes);
app.use("/api/usuarios", usuariosRoutes);
app.use("/api/agenda", agendaRoutes);
app.use("/api/salas", salasRoutes);
app.use("/api/prontuario", prontuarioRoutes);
app.use("/api/financeiro", financeiroRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/notas-fiscais", notasfiscaisRoutes);
app.use("/api/mensagens", mensagensRoutes);
app.use("/api/pagamentos", pagamentosRoutes);
app.use("/uploads", express.static(uploadDir));

app.use(errorHandler);

const port = Number(process.env.PORT) || 3333;
app.listen(port, () => {
  console.log(`DentalSys API rodando em http://localhost:${port}`);
  iniciarAgendadorMensagens();
});
