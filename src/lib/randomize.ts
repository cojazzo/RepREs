import { ArmLabel, Treatment } from '@prisma/client';
import { prisma } from './prisma';

export async function getBlockSizes(): Promise<number[]> {
    const config = await prisma.studyConfig.findUnique({ where: { key: 'BLOCK_SIZES' } });
    if (!config) return [4, 6];
    return config.value.split(',').map(Number);
}

function shuffleArray<T>(array: T[]): T[] {
    const a = [...array];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

export async function assignRandomization(participantId: string): Promise<{
    armLabel: ArmLabel;
    treatment: Treatment;
}> {
    const blockSizes = await getBlockSizes();

    // Determine the stratum based on ACR values from screening
    const screening = await prisma.screeningChecklist.findUnique({
        where: { participantId }
    });

    let stratum = 'UNKNOWN';
    if (screening && screening.acrValue1 !== null && screening.acrValue2 !== null) {
        const averageAcr = (screening.acrValue1 + screening.acrValue2) / 2;
        stratum = averageAcr <= 300 ? 'ACR_LE_300' : 'ACR_GT_300';
    }

    // Find the latest block for THIS stratum
    const lastRandom = await prisma.randomization.findFirst({
        where: { stratum },
        orderBy: { randomizedAt: 'desc' },
    });

    let blockId = 1;
    let blockSize = blockSizes[Math.floor(Math.random() * blockSizes.length)];
    let sequenceInBlock = 0;

    if (lastRandom) {
        const countInBlock = await prisma.randomization.count({
            where: { blockId: lastRandom.blockId, stratum },
        });

        if (countInBlock >= lastRandom.blockSize) {
            // Start new block
            blockId = lastRandom.blockId + 1;
            blockSize = blockSizes[Math.floor(Math.random() * blockSizes.length)];
            sequenceInBlock = 0;
        } else {
            blockId = lastRandom.blockId;
            blockSize = lastRandom.blockSize;
            sequenceInBlock = countInBlock;
        }
    }

    // Get existing assignments in block to determine next
    const existingInBlock = await prisma.randomization.findMany({
        where: { blockId, stratum },
        orderBy: { sequenceInBlock: 'asc' },
    });

    let armLabel: ArmLabel;
    if (existingInBlock.length === 0) {
        // First in new block - generate full permuted block
        const half = blockSize / 2;
        const assignments: ArmLabel[] = [];
        for (let i = 0; i < half; i++) assignments.push(ArmLabel.A);
        for (let i = 0; i < half; i++) assignments.push(ArmLabel.B);
        const shuffled = shuffleArray(assignments);
        armLabel = shuffled[0];
    } else {
        // Count current balance in block
        const aCount = existingInBlock.filter(r => r.armLabel === ArmLabel.A).length;
        const bCount = existingInBlock.filter(r => r.armLabel === ArmLabel.B).length;
        const halfBlock = blockSize / 2;

        if (aCount >= halfBlock) {
            armLabel = ArmLabel.B;
        } else if (bCount >= halfBlock) {
            armLabel = ArmLabel.A;
        } else {
            armLabel = Math.random() < 0.5 ? ArmLabel.A : ArmLabel.B;
        }
    }

    const treatment = armLabel === ArmLabel.A ? Treatment.DAPAGLIFLOZIN_10MG : Treatment.PLACEBO;

    await prisma.randomization.create({
        data: {
            participantId,
            armLabel,
            treatment,
            stratum,
            blockId,
            blockSize,
            sequenceInBlock,
        },
    });

    return { armLabel, treatment };
}
