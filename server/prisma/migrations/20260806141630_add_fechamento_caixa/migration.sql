-- CreateTable
CREATE TABLE "FechamentoCaixa" (
    "id" TEXT NOT NULL,
    "clinicaId" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "situacao" TEXT NOT NULL DEFAULT 'aberto',
    "dinheiroInicial" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalReceitas" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalDespesas" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalGeral" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "valorInformado" DECIMAL(65,30),
    "divergencia" DECIMAL(65,30),
    "observacoes" TEXT,
    "usuarioId" TEXT,
    "abertoEm" TIMESTAMP(3),
    "fechadoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FechamentoCaixa_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FechamentoCaixa_clinicaId_idx" ON "FechamentoCaixa"("clinicaId");

-- CreateIndex
CREATE UNIQUE INDEX "FechamentoCaixa_clinicaId_data_key" ON "FechamentoCaixa"("clinicaId", "data");

-- AddForeignKey
ALTER TABLE "FechamentoCaixa" ADD CONSTRAINT "FechamentoCaixa_clinicaId_fkey" FOREIGN KEY ("clinicaId") REFERENCES "Clinica"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FechamentoCaixa" ADD CONSTRAINT "FechamentoCaixa_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
