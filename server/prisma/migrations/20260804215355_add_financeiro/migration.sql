-- CreateEnum
CREATE TYPE "TipoLancamento" AS ENUM ('receita', 'despesa');

-- CreateEnum
CREATE TYPE "FormaPagamento" AS ENUM ('dinheiro', 'pix', 'cartao_credito', 'cartao_debito', 'convenio', 'transferencia');

-- CreateEnum
CREATE TYPE "StatusLancamento" AS ENUM ('pendente', 'pago', 'cancelado');

-- CreateTable
CREATE TABLE "Lancamento" (
    "id" TEXT NOT NULL,
    "clinicaId" TEXT NOT NULL,
    "tipo" "TipoLancamento" NOT NULL DEFAULT 'receita',
    "descricao" TEXT NOT NULL,
    "valor" DECIMAL(65,30) NOT NULL,
    "formaPagamento" "FormaPagamento",
    "status" "StatusLancamento" NOT NULL DEFAULT 'pendente',
    "pacienteId" TEXT,
    "profissionalId" TEXT,
    "procedimentoId" TEXT,
    "dataVencimento" TIMESTAMP(3),
    "dataPagamento" TIMESTAMP(3),
    "observacoes" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Lancamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comissao" (
    "id" TEXT NOT NULL,
    "clinicaId" TEXT NOT NULL,
    "lancamentoId" TEXT NOT NULL,
    "profissionalId" TEXT NOT NULL,
    "percentual" DECIMAL(65,30) NOT NULL,
    "valor" DECIMAL(65,30) NOT NULL,
    "paga" BOOLEAN NOT NULL DEFAULT false,
    "pagaEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Comissao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Lancamento_clinicaId_status_idx" ON "Lancamento"("clinicaId", "status");

-- CreateIndex
CREATE INDEX "Lancamento_clinicaId_dataVencimento_idx" ON "Lancamento"("clinicaId", "dataVencimento");

-- CreateIndex
CREATE INDEX "Lancamento_pacienteId_idx" ON "Lancamento"("pacienteId");

-- CreateIndex
CREATE UNIQUE INDEX "Comissao_lancamentoId_profissionalId_key" ON "Comissao"("lancamentoId", "profissionalId");

-- AddForeignKey
ALTER TABLE "Lancamento" ADD CONSTRAINT "Lancamento_clinicaId_fkey" FOREIGN KEY ("clinicaId") REFERENCES "Clinica"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lancamento" ADD CONSTRAINT "Lancamento_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "Paciente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lancamento" ADD CONSTRAINT "Lancamento_profissionalId_fkey" FOREIGN KEY ("profissionalId") REFERENCES "Profissional"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lancamento" ADD CONSTRAINT "Lancamento_procedimentoId_fkey" FOREIGN KEY ("procedimentoId") REFERENCES "Procedimento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comissao" ADD CONSTRAINT "Comissao_clinicaId_fkey" FOREIGN KEY ("clinicaId") REFERENCES "Clinica"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comissao" ADD CONSTRAINT "Comissao_lancamentoId_fkey" FOREIGN KEY ("lancamentoId") REFERENCES "Lancamento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comissao" ADD CONSTRAINT "Comissao_profissionalId_fkey" FOREIGN KEY ("profissionalId") REFERENCES "Profissional"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
