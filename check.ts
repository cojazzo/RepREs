import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
prisma.crfLabAnalyte.findMany().then(c => {
    console.log(c.map(a => `${a.code}: ${a.name}`).join('\n'));
}).finally(() => prisma.$disconnect());
