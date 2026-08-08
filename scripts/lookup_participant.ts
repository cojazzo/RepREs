import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    const participants = await prisma.participant.findMany({
      where: {
        OR: [
          { chmhId: "2026-06937" },
          { curp: "BAMC110812MASTRYA0" },
          { firstName: { contains: "CINTHYA", mode: 'insensitive' } }
        ]
      },
      include: {
        screening: true,
        randomization: true
      }
    });

    console.log("Found participants:", JSON.stringify(participants, null, 2));
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
