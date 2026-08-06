-- CreateTable
CREATE TABLE "MensagemTemplate" (
    "id" TEXT NOT NULL,
    "clinicaId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MensagemTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MensagemTemplate_clinicaId_tipo_key" ON "MensagemTemplate"("clinicaId", "tipo");

-- AddForeignKey
ALTER TABLE "MensagemTemplate" ADD CONSTRAINT "MensagemTemplate_clinicaId_fkey" FOREIGN KEY ("clinicaId") REFERENCES "Clinica"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
