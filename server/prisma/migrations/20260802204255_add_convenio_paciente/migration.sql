-- AlterTable
ALTER TABLE "Paciente" ADD COLUMN     "convenioId" TEXT;

-- AddForeignKey
ALTER TABLE "Paciente" ADD CONSTRAINT "Paciente_convenioId_fkey" FOREIGN KEY ("convenioId") REFERENCES "Convenio"("id") ON DELETE SET NULL ON UPDATE CASCADE;
