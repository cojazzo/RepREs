const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function fixBaselines() { 
    const res = await prisma.appointment.findMany({ include: { visit: true } }); 
    let updated = 0; 
    for (const a of res) { 
        if (a.visit && a.visit.visitType === 'BASELINE' && a.status !== 'COMPLETED') { 
            await prisma.appointment.update({ where: { id: a.id }, data: { status: 'COMPLETED', completedAt: a.scheduledDate } }); 
            updated++; 
        } 
    } 
    console.log('Fixed ' + updated + ' baselines.'); 
    await prisma.$disconnect(); 
} 
fixBaselines();
