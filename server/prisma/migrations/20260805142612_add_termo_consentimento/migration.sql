-- CreateTable
CREATE TABLE "TermoConsentimento" (
    "id" TEXT NOT NULL,
    "clinicaId" TEXT NOT NULL,
    "pacienteId" TEXT NOT NULL,
    "profissionalId" TEXT,
    "titulo" TEXT NOT NULL,
    "conteudo" TEXT NOT NULL,
    "assinado" BOOLEAN NOT NULL DEFAULT false,
    "dataAssinatura" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TermoConsentimento_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "TermoConsentimento" ADD CONSTRAINT "TermoConsentimento_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "Paciente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TermoConsentimento" ADD CONSTRAINT "TermoConsentimento_profissionalId_fkey" FOREIGN KEY ("profissionalId") REFERENCES "Profissional"("id") ON DELETE SET NULL ON UPDATE CASCADE;
