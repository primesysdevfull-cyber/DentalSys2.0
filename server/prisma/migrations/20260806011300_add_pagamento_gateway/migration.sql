-- CreateTable
CREATE TABLE "ConfigPagamento" (
    "id" TEXT NOT NULL,
    "clinicaId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'efi',
    "ambiente" TEXT NOT NULL DEFAULT 'sandbox',
    "clientId" TEXT,
    "clientSecret" TEXT,
    "pixChave" TEXT,
    "webhookSecret" TEXT,
    "ativa" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConfigPagamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cobranca" (
    "id" TEXT NOT NULL,
    "clinicaId" TEXT NOT NULL,
    "lancamentoId" TEXT NOT NULL,
    "gateway" TEXT NOT NULL DEFAULT 'efi',
    "forma" TEXT NOT NULL,
    "valor" DECIMAL(65,30) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pendente',
    "gatewayId" TEXT,
    "pixCopiaECola" TEXT,
    "pixQrCodeUrl" TEXT,
    "boletoLinha" TEXT,
    "boletoUrl" TEXT,
    "cartaoLink" TEXT,
    "dataVencimento" TIMESTAMP(3),
    "dataPagamento" TIMESTAMP(3),
    "erro" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cobranca_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ConfigPagamento_clinicaId_key" ON "ConfigPagamento"("clinicaId");

-- CreateIndex
CREATE INDEX "Cobranca_clinicaId_status_idx" ON "Cobranca"("clinicaId", "status");

-- CreateIndex
CREATE INDEX "Cobranca_lancamentoId_idx" ON "Cobranca"("lancamentoId");

-- AddForeignKey
ALTER TABLE "ConfigPagamento" ADD CONSTRAINT "ConfigPagamento_clinicaId_fkey" FOREIGN KEY ("clinicaId") REFERENCES "Clinica"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cobranca" ADD CONSTRAINT "Cobranca_clinicaId_fkey" FOREIGN KEY ("clinicaId") REFERENCES "Clinica"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cobranca" ADD CONSTRAINT "Cobranca_lancamentoId_fkey" FOREIGN KEY ("lancamentoId") REFERENCES "Lancamento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
