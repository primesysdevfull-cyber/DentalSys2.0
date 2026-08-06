-- DropForeignKey
ALTER TABLE "Cobranca" DROP CONSTRAINT "Cobranca_lancamentoId_fkey";

-- AddForeignKey
ALTER TABLE "Cobranca" ADD CONSTRAINT "Cobranca_lancamentoId_fkey" FOREIGN KEY ("lancamentoId") REFERENCES "Lancamento"("id") ON DELETE CASCADE ON UPDATE CASCADE;
