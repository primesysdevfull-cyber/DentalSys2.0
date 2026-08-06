-- CreateEnum
CREATE TYPE "Cargo" AS ENUM ('administrador', 'dentista', 'recepcionista');

-- CreateTable
CREATE TABLE "Clinica" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cnpj" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telefone" TEXT,
    "endereco" TEXT,
    "razaoSocial" TEXT,
    "responsavel" TEXT,
    "logoUrl" TEXT,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Clinica_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "clinicaId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "cargo" "Cargo" NOT NULL DEFAULT 'recepcionista',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Paciente" (
    "id" TEXT NOT NULL,
    "clinicaId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "dataNascimento" TIMESTAMP(3),
    "cpf" TEXT,
    "rg" TEXT,
    "telefone" TEXT,
    "whatsapp" TEXT,
    "email" TEXT,
    "endereco" TEXT,
    "contatoEmergencial" TEXT,
    "alergias" TEXT,
    "indicacao" TEXT,
    "observacoes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ativo',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Paciente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Profissional" (
    "id" TEXT NOT NULL,
    "clinicaId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cro" TEXT NOT NULL,
    "especialidade" TEXT,
    "horarioAtendimento" TEXT,
    "comissao" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Profissional_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Procedimento" (
    "id" TEXT NOT NULL,
    "clinicaId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "codigoTuss" TEXT,
    "valorParticular" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "duracaoMedia" INTEGER NOT NULL DEFAULT 30,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Procedimento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Convenio" (
    "id" TEXT NOT NULL,
    "clinicaId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "registro" TEXT,
    "telefone" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Convenio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConvenioProcedimento" (
    "id" TEXT NOT NULL,
    "convenioId" TEXT NOT NULL,
    "procedimentoId" TEXT NOT NULL,
    "valor" DECIMAL(65,30) NOT NULL DEFAULT 0,

    CONSTRAINT "ConvenioProcedimento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Prontuario" (
    "id" TEXT NOT NULL,
    "pacienteId" TEXT NOT NULL,
    "clinicaId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "conteudo" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'evolucao',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Prontuario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Clinica_cnpj_key" ON "Clinica"("cnpj");

-- CreateIndex
CREATE UNIQUE INDEX "Clinica_email_key" ON "Clinica"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Profissional_usuarioId_key" ON "Profissional"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "ConvenioProcedimento_convenioId_procedimentoId_key" ON "ConvenioProcedimento"("convenioId", "procedimentoId");

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_clinicaId_fkey" FOREIGN KEY ("clinicaId") REFERENCES "Clinica"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Paciente" ADD CONSTRAINT "Paciente_clinicaId_fkey" FOREIGN KEY ("clinicaId") REFERENCES "Clinica"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Profissional" ADD CONSTRAINT "Profissional_clinicaId_fkey" FOREIGN KEY ("clinicaId") REFERENCES "Clinica"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Profissional" ADD CONSTRAINT "Profissional_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Procedimento" ADD CONSTRAINT "Procedimento_clinicaId_fkey" FOREIGN KEY ("clinicaId") REFERENCES "Clinica"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Convenio" ADD CONSTRAINT "Convenio_clinicaId_fkey" FOREIGN KEY ("clinicaId") REFERENCES "Clinica"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConvenioProcedimento" ADD CONSTRAINT "ConvenioProcedimento_convenioId_fkey" FOREIGN KEY ("convenioId") REFERENCES "Convenio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConvenioProcedimento" ADD CONSTRAINT "ConvenioProcedimento_procedimentoId_fkey" FOREIGN KEY ("procedimentoId") REFERENCES "Procedimento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prontuario" ADD CONSTRAINT "Prontuario_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "Paciente"("id") ON DELETE CASCADE ON UPDATE CASCADE;
