-- CreateEnum
CREATE TYPE "CondicaoDente" AS ENUM ('saudavel', 'carie', 'restauracao', 'extraido', 'canal', 'coroa', 'implante', 'ausente');

-- CreateTable
CREATE TABLE "OdontogramaDente" (
    "id" TEXT NOT NULL,
    "clinicaId" TEXT NOT NULL,
    "pacienteId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "condicao" "CondicaoDente" NOT NULL DEFAULT 'saudavel',
    "observacao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OdontogramaDente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evolucao" (
    "id" TEXT NOT NULL,
    "clinicaId" TEXT NOT NULL,
    "pacienteId" TEXT NOT NULL,
    "profissionalId" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "conduta" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Evolucao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Exame" (
    "id" TEXT NOT NULL,
    "clinicaId" TEXT NOT NULL,
    "pacienteId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'imagem',
    "descricao" TEXT,
    "arquivoUrl" TEXT,
    "arquivoNome" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Exame_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Receituario" (
    "id" TEXT NOT NULL,
    "clinicaId" TEXT NOT NULL,
    "pacienteId" TEXT NOT NULL,
    "profissionalId" TEXT NOT NULL,
    "medicamentos" TEXT NOT NULL,
    "instrucoes" TEXT,
    "assinatura" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Receituario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OdontogramaDente_pacienteId_numero_key" ON "OdontogramaDente"("pacienteId", "numero");

-- AddForeignKey
ALTER TABLE "OdontogramaDente" ADD CONSTRAINT "OdontogramaDente_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "Paciente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evolucao" ADD CONSTRAINT "Evolucao_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "Paciente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evolucao" ADD CONSTRAINT "Evolucao_profissionalId_fkey" FOREIGN KEY ("profissionalId") REFERENCES "Profissional"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exame" ADD CONSTRAINT "Exame_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "Paciente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receituario" ADD CONSTRAINT "Receituario_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "Paciente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receituario" ADD CONSTRAINT "Receituario_profissionalId_fkey" FOREIGN KEY ("profissionalId") REFERENCES "Profissional"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
