/**
 * Calculate BMI from weight (kg) and height (cm)
 */
export function calculateBMI(weightKg: number, heightCm: number): number {
    const heightM = heightCm / 100;
    return Math.round((weightKg / (heightM * heightM)) * 10) / 10;
}

/**
 * Calculate eGFR using CKD-EPI 2021 equation
 * 142 × min(SCr/κ, 1)^α × max(SCr/κ, 1)^(−1.200) × 0.9938^age × (1.012 if female)
 */
export function calculateEGFR(
    serumCreatinine: number,
    age: number,
    sex: 'Male' | 'Female'
): number {
    const kappa = sex === 'Female' ? 0.7 : 0.9;
    const alpha = sex === 'Female' ? -0.241 : -0.302;

    const minRatio = Math.min(serumCreatinine / kappa, 1);
    const maxRatio = Math.max(serumCreatinine / kappa, 1);

    let eGFR = 142 * Math.pow(minRatio, alpha) * Math.pow(maxRatio, -1.200) * Math.pow(0.9938, age);

    if (sex === 'Female') {
        eGFR *= 1.012;
    }

    return Math.round(eGFR * 10) / 10;
}

/**
 * Calculate ACR (Albumin-to-Creatinine Ratio)
 * ACR = (urine albumin mg/L) / (urine creatinine mg/dL) * 1000
 * Result in mg/g
 */
export function calculateACR(urineAlbumin: number, urineCreatinine: number): number {
    if (urineCreatinine === 0) return 0;
    return Math.round((urineAlbumin / urineCreatinine) * 1000 * 10) / 10;
}

/**
 * Calculate age from birth date
 */
export function calculateAge(birthDate: Date): number {
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    return age;
}
