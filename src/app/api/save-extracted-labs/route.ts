import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { extractedData, visitType, participantId } = body;

    if (!extractedData || !visitType || !participantId) {
      return NextResponse.json({ error: 'Missing extractedData, visitType, or participantId' }, { status: 400 });
    }

    // 1. Verify Participant
    const participant = await prisma.participant.findUnique({
      where: { id: participantId }
    });

    if (!participant) {
      return NextResponse.json({ error: `Participant not found in the database.` }, { status: 404 });
    }

    // 2. Find or Create Visit
    let visit = await prisma.visit.findUnique({
      where: {
        participantId_visitType: {
          participantId: participant.id,
          visitType: visitType
        }
      }
    });

    if (!visit) {
      visit = await prisma.visit.create({
        data: {
          participantId: participant.id,
          visitType: visitType,
          status: 'DRAFT',
        }
      });
    }

    // 4. Load all Analytes to map Spanish names to analyte codes
    const analytes = await prisma.crfLabAnalyte.findMany();
    const analyteMap: Record<string, string> = {};
    for (const analyte of analytes) {
      // Create a normalized key (lowercase, no extra spaces) to ensure matching is robust
      analyteMap[analyte.name.toLowerCase().trim()] = analyte.code;
    }

    // 5. Upsert Lab Results
    let savedCount = 0;
    for (const [key, resultObj] of Object.entries(extractedData)) {
      if (key === "Paciente (Nombre completo)" || key === "Edad" || key === "Sexo" || key.toLowerCase().includes('expediente')) {
        continue; // Skip demographics
      }

      const normalizedKey = key.toLowerCase().trim();
      const code = analyteMap[normalizedKey];
      
      const res = resultObj as { value?: string | number, unit?: string };
      if (code && res && res.value !== undefined && res.value !== null && res.value !== "") {
        await prisma.crfLabResult.upsert({
          where: {
            visitId_analyteCode: {
              visitId: visit.id,
              analyteCode: code
            }
          },
          update: {
            value: String(res.value),
            unit: res.unit || null
          },
          create: {
            visitId: visit.id,
            analyteCode: code,
            value: String(res.value),
            unit: res.unit || null
          }
        });
        
        // Also update LabResult if necessary since the UI might query that depending on how they implemented summary!
        // We will do both just in case. LabsPage uses LabResult which maps to AnalyteCatalog!
        const catalogAnalyte = await prisma.analyteCatalog.findUnique({ where: { code } });
        if (catalogAnalyte) {
           await prisma.labResult.upsert({
              where: {
                visitId_analyteId: {
                   visitId: visit.id,
                   analyteId: catalogAnalyte.id
                }
              },
              update: {
                value: parseFloat(String(res.value)) || null,
                unit: res.unit || null
              },
              create: {
                visitId: visit.id,
                analyteId: catalogAnalyte.id,
                value: parseFloat(String(res.value)) || null,
                unit: res.unit || null
              }
           });
        }
        savedCount++;
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: `Successfully mapped participant ${participant.studyId} and saved ${savedCount} lab values to ${visitType} visit.`,
      participantId: participant.id
    });

  } catch (error: any) {
    console.error('Save error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
