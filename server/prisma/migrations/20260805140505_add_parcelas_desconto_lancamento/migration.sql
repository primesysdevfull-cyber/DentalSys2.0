-- AlterTable
ALTER TABLE "Lancamento" ADD COLUMN     "desconto" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN     "grupoParcelas" TEXT,
ADD COLUMN     "numeroParcela" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "quantidadeParcelas" INTEGER NOT NULL DEFAULT 1;
