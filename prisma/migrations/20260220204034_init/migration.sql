-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'INVESTIGATOR', 'DATA_ENTRY', 'MONITOR', 'PHARMACY', 'READ_ONLY');

-- CreateEnum
CREATE TYPE "ParticipantStatus" AS ENUM ('SCREENING', 'ACTIVE', 'WITHDRAWN', 'COMPLETED', 'LOST_TO_FOLLOWUP');

-- CreateEnum
CREATE TYPE "VisitType" AS ENUM ('BASELINE', 'MONTH_2', 'MONTH_4', 'MONTH_6');

-- CreateEnum
CREATE TYPE "ArmLabel" AS ENUM ('A', 'B');

-- CreateEnum
CREATE TYPE "Treatment" AS ENUM ('DAPAGLIFLOZIN_10MG', 'PLACEBO');

-- CreateEnum
CREATE TYPE "AESeverity" AS ENUM ('MILD', 'MODERATE', 'SEVERE');

-- CreateEnum
CREATE TYPE "AERelation" AS ENUM ('UNRELATED', 'UNLIKELY', 'POSSIBLE', 'PROBABLE', 'DEFINITE');

-- CreateEnum
CREATE TYPE "AEOutcome" AS ENUM ('RECOVERED', 'RECOVERING', 'NOT_RECOVERED', 'FATAL', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "QueryStatus" AS ENUM ('OPEN', 'RESPONDED', 'RESOLVED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'READ_ONLY',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Participant" (
    "id" TEXT NOT NULL,
    "studyId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "sex" TEXT NOT NULL,
    "birthDate" TIMESTAMP(3) NOT NULL,
    "site" TEXT,
    "status" "ParticipantStatus" NOT NULL DEFAULT 'SCREENING',
    "consentDate" TIMESTAMP(3),
    "enrolledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Participant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScreeningChecklist" (
    "id" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "ageOver18" BOOLEAN NOT NULL DEFAULT false,
    "confirmedDiagnosis" BOOLEAN NOT NULL DEFAULT false,
    "informedConsent" BOOLEAN NOT NULL DEFAULT false,
    "willingToComply" BOOLEAN NOT NULL DEFAULT false,
    "severeRenalImpairment" BOOLEAN NOT NULL DEFAULT false,
    "pregnancy" BOOLEAN NOT NULL DEFAULT false,
    "knownAllergy" BOOLEAN NOT NULL DEFAULT false,
    "activeInfection" BOOLEAN NOT NULL DEFAULT false,
    "eligible" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScreeningChecklist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Randomization" (
    "id" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "armLabel" "ArmLabel" NOT NULL,
    "treatment" "Treatment" NOT NULL,
    "blockId" INTEGER NOT NULL,
    "blockSize" INTEGER NOT NULL,
    "sequenceInBlock" INTEGER NOT NULL,
    "randomizedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Randomization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Visit" (
    "id" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "visitType" "VisitType" NOT NULL,
    "visitDate" TIMESTAMP(3),
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Visit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vitals" (
    "id" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "weightKg" DOUBLE PRECISION,
    "heightCm" DOUBLE PRECISION,
    "bmi" DOUBLE PRECISION,
    "systolicBp" INTEGER,
    "diastolicBp" INTEGER,
    "heartRate" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vitals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClinicalAssessment" (
    "id" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "symptoms" TEXT,
    "physicalExamNotes" TEXT,
    "continuationCriteria" BOOLEAN NOT NULL DEFAULT true,
    "continuationNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClinicalAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Adherence" (
    "id" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "adherencePercent" DOUBLE PRECISION,
    "missedDoses" INTEGER,
    "reasonForNonAdherence" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Adherence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdverseEvent" (
    "id" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "visitType" "VisitType",
    "description" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "severity" "AESeverity" NOT NULL,
    "relation" "AERelation" NOT NULL,
    "outcome" "AEOutcome" NOT NULL,
    "isSAE" BOOLEAN NOT NULL DEFAULT false,
    "saeDetails" TEXT,
    "actionTaken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdverseEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LabResult" (
    "id" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "analyteId" TEXT NOT NULL,
    "value" DOUBLE PRECISION,
    "unit" TEXT,
    "referenceMin" DOUBLE PRECISION,
    "referenceMax" DOUBLE PRECISION,
    "isAbnormal" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LabResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalyteCatalog" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "refMin" DOUBLE PRECISION,
    "refMax" DOUBLE PRECISION,
    "category" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isComputed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalyteCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConcomitantMed" (
    "id" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dose" TEXT,
    "frequency" TEXT,
    "indication" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConcomitantMed_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dispensation" (
    "id" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "visitType" "VisitType" NOT NULL,
    "dispensedDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lotNumber" TEXT NOT NULL,
    "tabletsDispensed" INTEGER NOT NULL,
    "tabletsReturned" INTEGER,
    "adherenceByPillCount" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Dispensation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnblindingLog" (
    "id" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "authorizedBy" TEXT,
    "unblindedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UnblindingLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "field" TEXT,
    "oldValue" TEXT,
    "newValue" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataQuery" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "responderId" TEXT,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "queryText" TEXT NOT NULL,
    "responseText" TEXT,
    "status" "QueryStatus" NOT NULL DEFAULT 'OPEN',
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DataQuery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudyConfig" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudyConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Participant_studyId_key" ON "Participant"("studyId");

-- CreateIndex
CREATE INDEX "Participant_status_idx" ON "Participant"("status");

-- CreateIndex
CREATE INDEX "Participant_site_idx" ON "Participant"("site");

-- CreateIndex
CREATE UNIQUE INDEX "ScreeningChecklist_participantId_key" ON "ScreeningChecklist"("participantId");

-- CreateIndex
CREATE UNIQUE INDEX "Randomization_participantId_key" ON "Randomization"("participantId");

-- CreateIndex
CREATE INDEX "Randomization_armLabel_idx" ON "Randomization"("armLabel");

-- CreateIndex
CREATE INDEX "Visit_visitType_idx" ON "Visit"("visitType");

-- CreateIndex
CREATE UNIQUE INDEX "Visit_participantId_visitType_key" ON "Visit"("participantId", "visitType");

-- CreateIndex
CREATE UNIQUE INDEX "Vitals_visitId_key" ON "Vitals"("visitId");

-- CreateIndex
CREATE UNIQUE INDEX "ClinicalAssessment_visitId_key" ON "ClinicalAssessment"("visitId");

-- CreateIndex
CREATE UNIQUE INDEX "Adherence_visitId_key" ON "Adherence"("visitId");

-- CreateIndex
CREATE INDEX "AdverseEvent_severity_idx" ON "AdverseEvent"("severity");

-- CreateIndex
CREATE INDEX "AdverseEvent_isSAE_idx" ON "AdverseEvent"("isSAE");

-- CreateIndex
CREATE UNIQUE INDEX "LabResult_visitId_analyteId_key" ON "LabResult"("visitId", "analyteId");

-- CreateIndex
CREATE UNIQUE INDEX "AnalyteCatalog_name_key" ON "AnalyteCatalog"("name");

-- CreateIndex
CREATE UNIQUE INDEX "AnalyteCatalog_code_key" ON "AnalyteCatalog"("code");

-- CreateIndex
CREATE INDEX "Dispensation_participantId_idx" ON "Dispensation"("participantId");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "DataQuery_status_idx" ON "DataQuery"("status");

-- CreateIndex
CREATE UNIQUE INDEX "StudyConfig_key_key" ON "StudyConfig"("key");

-- AddForeignKey
ALTER TABLE "ScreeningChecklist" ADD CONSTRAINT "ScreeningChecklist_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Randomization" ADD CONSTRAINT "Randomization_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vitals" ADD CONSTRAINT "Vitals_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalAssessment" ADD CONSTRAINT "ClinicalAssessment_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Adherence" ADD CONSTRAINT "Adherence_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdverseEvent" ADD CONSTRAINT "AdverseEvent_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabResult" ADD CONSTRAINT "LabResult_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabResult" ADD CONSTRAINT "LabResult_analyteId_fkey" FOREIGN KEY ("analyteId") REFERENCES "AnalyteCatalog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConcomitantMed" ADD CONSTRAINT "ConcomitantMed_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispensation" ADD CONSTRAINT "Dispensation_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnblindingLog" ADD CONSTRAINT "UnblindingLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataQuery" ADD CONSTRAINT "DataQuery_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataQuery" ADD CONSTRAINT "DataQuery_responderId_fkey" FOREIGN KEY ("responderId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
