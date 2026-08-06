-- CreateTable
CREATE TABLE "ConfigNfse" (
    "id" TEXT NOT NULL,
    "clinicaId" TEXT NOT NULL,
    "municipio" TEXT,
    "uf" TEXT,
    "ibge" TEXT,
    "inscricaoMunicipal" TEXT,
    "endpointHomologacao" TEXT,
    "endpointProducao" TEXT,
    "certPath" TEXT,
    "certPassword" TEXT,
    "ambiente" TEXT NOT NULL DEFAULT 'homologacao',
    "ativa" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConfigNfse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ConfigNfse_clinicaId_key" ON "ConfigNfse"("clinicaId");

-- AddForeignKey
ALTER TABLE "ConfigNfse" ADD CONSTRAINT "ConfigNfse_clinicaId_fkey" FOREIGN KEY ("clinicaId") REFERENCES "Clinica"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
