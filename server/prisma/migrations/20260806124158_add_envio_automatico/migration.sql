-- AlterTable
ALTER TABLE "Agendamento" ADD COLUMN     "lembreteEnviado" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ConfigMensagem" (
    "id" TEXT NOT NULL,
    "clinicaId" TEXT NOT NULL,
    "antecedenciaMin" INTEGER NOT NULL DEFAULT 1440,
    "ativoLembrete" BOOLEAN NOT NULL DEFAULT true,
    "ativoRetorno" BOOLEAN NOT NULL DEFAULT true,
    "ativoAniversario" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConfigMensagem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MensagemEnviada" (
    "id" TEXT NOT NULL,
    "clinicaId" TEXT NOT NULL,
    "pacienteId" TEXT,
    "agendamentoId" TEXT,
    "tipo" TEXT NOT NULL,
    "contato" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "enviado" BOOLEAN NOT NULL,
    "metodo" TEXT NOT NULL,
    "detalhe" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MensagemEnviada_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ConfigMensagem_clinicaId_key" ON "ConfigMensagem"("clinicaId");

-- CreateIndex
CREATE INDEX "ConfigMensagem_clinicaId_idx" ON "ConfigMensagem"("clinicaId");

-- CreateIndex
CREATE INDEX "MensagemEnviada_clinicaId_tipo_criadoEm_idx" ON "MensagemEnviada"("clinicaId", "tipo", "criadoEm");

-- CreateIndex
CREATE INDEX "MensagemEnviada_pacienteId_tipo_idx" ON "MensagemEnviada"("pacienteId", "tipo");

-- AddForeignKey
ALTER TABLE "ConfigMensagem" ADD CONSTRAINT "ConfigMensagem_clinicaId_fkey" FOREIGN KEY ("clinicaId") REFERENCES "Clinica"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MensagemEnviada" ADD CONSTRAINT "MensagemEnviada_clinicaId_fkey" FOREIGN KEY ("clinicaId") REFERENCES "Clinica"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MensagemEnviada" ADD CONSTRAINT "MensagemEnviada_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "Paciente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MensagemEnviada" ADD CONSTRAINT "MensagemEnviada_agendamentoId_fkey" FOREIGN KEY ("agendamentoId") REFERENCES "Agendamento"("id") ON DELETE SET NULL ON UPDATE CASCADE;
