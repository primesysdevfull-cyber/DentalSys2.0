-- CreateEnum
CREATE TYPE "StatusNotaFiscal" AS ENUM ('rascunho', 'loteEnviado', 'autorizada', 'rejeitada', 'cancelada');

-- CreateEnum
CREATE TYPE "TipoNotaFiscal" AS ENUM ('nfs_e', 'nf_e');

-- CreateTable
CREATE TABLE "IntegracaoFiscal" (
    "id" TEXT NOT NULL,
    "clinicaId" TEXT NOT NULL,
    "provedor" TEXT NOT NULL,
    "chave" TEXT,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegracaoFiscal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotaFiscal" (
    "id" TEXT NOT NULL,
    "clinicaId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "serie" TEXT NOT NULL DEFAULT '1',
    "tipo" "TipoNotaFiscal" NOT NULL DEFAULT 'nfs_e',
    "status" "StatusNotaFiscal" NOT NULL DEFAULT 'rascunho',
    "valor" DECIMAL(65,30) NOT NULL,
    "descricao" TEXT NOT NULL,
    "codigoServico" TEXT,
    "aliquota" DECIMAL(65,30) NOT NULL DEFAULT 5,
    "deducao" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "issRetido" BOOLEAN NOT NULL DEFAULT false,
    "observacao" TEXT,
    "pacienteId" TEXT NOT NULL,
    "lancamentoId" TEXT,
    "agendamentoId" TEXT,
    "provedor" TEXT NOT NULL DEFAULT 'proprio',
    "xmlUrl" TEXT,
    "danfeUrl" TEXT,
    "protocolo" TEXT,
    "nfsNumero" TEXT,
    "externoId" TEXT,
    "mensagemRetorno" TEXT,
    "emitidaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "autorizadaEm" TIMESTAMP(3),
    "canceladaEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotaFiscal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IntegracaoFiscal_clinicaId_provedor_key" ON "IntegracaoFiscal"("clinicaId", "provedor");

-- CreateIndex
CREATE INDEX "NotaFiscal_clinicaId_status_idx" ON "NotaFiscal"("clinicaId", "status");

-- CreateIndex
CREATE INDEX "NotaFiscal_pacienteId_idx" ON "NotaFiscal"("pacienteId");

-- CreateIndex
CREATE UNIQUE INDEX "NotaFiscal_clinicaId_numero_key" ON "NotaFiscal"("clinicaId", "numero");

-- AddForeignKey
ALTER TABLE "IntegracaoFiscal" ADD CONSTRAINT "IntegracaoFiscal_clinicaId_fkey" FOREIGN KEY ("clinicaId") REFERENCES "Clinica"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotaFiscal" ADD CONSTRAINT "NotaFiscal_clinicaId_fkey" FOREIGN KEY ("clinicaId") REFERENCES "Clinica"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotaFiscal" ADD CONSTRAINT "NotaFiscal_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "Paciente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotaFiscal" ADD CONSTRAINT "NotaFiscal_lancamentoId_fkey" FOREIGN KEY ("lancamentoId") REFERENCES "Lancamento"("id") ON DELETE SET NULL ON UPDATE CASCADE;
