-- CreateEnum
CREATE TYPE "StatusAgendamento" AS ENUM ('agendado', 'confirmado', 'atendido', 'faltou', 'cancelado', 'bloqueado');

-- CreateTable
CREATE TABLE "Sala" (
    "id" TEXT NOT NULL,
    "clinicaId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sala_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Agendamento" (
    "id" TEXT NOT NULL,
    "clinicaId" TEXT NOT NULL,
    "pacienteId" TEXT,
    "profissionalId" TEXT NOT NULL,
    "salaId" TEXT,
    "procedimentoId" TEXT,
    "dataHora" TIMESTAMP(3) NOT NULL,
    "duracaoMin" INTEGER NOT NULL DEFAULT 30,
    "status" "StatusAgendamento" NOT NULL DEFAULT 'agendado',
    "observacoes" TEXT,
    "ehRetorno" BOOLEAN NOT NULL DEFAULT false,
    "confirmacaoEnviada" BOOLEAN NOT NULL DEFAULT false,
    "agendamentoOrigemId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Agendamento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Agendamento_clinicaId_dataHora_idx" ON "Agendamento"("clinicaId", "dataHora");

-- CreateIndex
CREATE INDEX "Agendamento_pacienteId_idx" ON "Agendamento"("pacienteId");

-- AddForeignKey
ALTER TABLE "Sala" ADD CONSTRAINT "Sala_clinicaId_fkey" FOREIGN KEY ("clinicaId") REFERENCES "Clinica"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agendamento" ADD CONSTRAINT "Agendamento_clinicaId_fkey" FOREIGN KEY ("clinicaId") REFERENCES "Clinica"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agendamento" ADD CONSTRAINT "Agendamento_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "Paciente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agendamento" ADD CONSTRAINT "Agendamento_profissionalId_fkey" FOREIGN KEY ("profissionalId") REFERENCES "Profissional"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agendamento" ADD CONSTRAINT "Agendamento_salaId_fkey" FOREIGN KEY ("salaId") REFERENCES "Sala"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agendamento" ADD CONSTRAINT "Agendamento_procedimentoId_fkey" FOREIGN KEY ("procedimentoId") REFERENCES "Procedimento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agendamento" ADD CONSTRAINT "Agendamento_agendamentoOrigemId_fkey" FOREIGN KEY ("agendamentoOrigemId") REFERENCES "Agendamento"("id") ON DELETE SET NULL ON UPDATE CASCADE;
