-- CreateEnum
CREATE TYPE "VisitStatus" AS ENUM ('DRAFT', 'SUBMITTED');

-- AlterTable
ALTER TABLE "Visit" ADD COLUMN     "status" "VisitStatus" NOT NULL DEFAULT 'DRAFT';

-- CreateTable
CREATE TABLE "VisitClinical" (
    "id" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "bpSys" INTEGER,
    "bpDia" INTEGER,
    "weightKg" DOUBLE PRECISION,
    "heightCm" DOUBLE PRECISION,
    "bmi" DOUBLE PRECISION,
    "waistCm" DOUBLE PRECISION,
    "hrBpm" INTEGER,
    "godet" INTEGER DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VisitClinical_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrfLabAnalyte" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "unit" TEXT,
    "coding" TEXT,
    "category" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrfLabAnalyte_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrfLabResult" (
    "id" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "analyteCode" TEXT NOT NULL,
    "value" TEXT,
    "unit" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrfLabResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisitAdherence" (
    "id" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "apegoGlobal" INTEGER,
    "dosisOlvidadas7d" INTEGER,
    "suspTrat" INTEGER,
    "diasSinTx" INTEGER,
    "motivoNoApego" INTEGER,
    "recordatorio" INTEGER,
    "accesoTx" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VisitAdherence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisitAe" (
    "id" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "eaNuevo" INTEGER,
    "eaAtencion" INTEGER,
    "eaSuspension" INTEGER,
    "eaMareo" INTEGER,
    "eaGi" INTEGER,
    "eaDolorAbd" INTEGER,
    "eaApetito" INTEGER,
    "eaFatiga" INTEGER,
    "eaDolorRenal" INTEGER,
    "eaEdema" INTEGER,
    "eaOliguria" INTEGER,
    "eaEspuma" INTEGER,
    "eaIvu" INTEGER,
    "eaSeveridad" INTEGER,
    "eaRelacion" INTEGER,
    "eaHosp" INTEGER,
    "eaDesc" TEXT,
    "observaciones" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VisitAe_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VisitClinical_visitId_key" ON "VisitClinical"("visitId");

-- CreateIndex
CREATE UNIQUE INDEX "CrfLabAnalyte_code_key" ON "CrfLabAnalyte"("code");

-- CreateIndex
CREATE UNIQUE INDEX "CrfLabResult_visitId_analyteCode_key" ON "CrfLabResult"("visitId", "analyteCode");

-- CreateIndex
CREATE UNIQUE INDEX "VisitAdherence_visitId_key" ON "VisitAdherence"("visitId");

-- CreateIndex
CREATE UNIQUE INDEX "VisitAe_visitId_key" ON "VisitAe"("visitId");

-- AddForeignKey
ALTER TABLE "VisitClinical" ADD CONSTRAINT "VisitClinical_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrfLabResult" ADD CONSTRAINT "CrfLabResult_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrfLabResult" ADD CONSTRAINT "CrfLabResult_analyteCode_fkey" FOREIGN KEY ("analyteCode") REFERENCES "CrfLabAnalyte"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitAdherence" ADD CONSTRAINT "VisitAdherence_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitAe" ADD CONSTRAINT "VisitAe_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
