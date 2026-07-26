// Shared fitness math. Kept dependency-free so it can be reused anywhere.

export const ACTIVITY_MULTIPLIERS: Record<string, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  athlete: 1.9,
};

export interface BodyInput {
  gender: string;
  age: number;
  heightCm: number;
  weightKg: number;
  bodyFatPct?: number | null;
  waistCm?: number | null;
  activityLevel: string;
  goal: string;
}

export interface FitnessComputation {
  bmi: number;
  bmiCategory: string;
  bmr: number;
  tdee: number;
  targetCalories: number;
  idealWeightMinKg: number;
  idealWeightMaxKg: number;
  fitnessLevel: string;
  fitnessScore: number; // 0-100
}

const round = (n: number, d = 0) => {
  const f = Math.pow(10, d);
  return Math.round(n * f) / f;
};

export const bmiCategoryOf = (bmi: number): string => {
  if (bmi < 18.5) return "Underweight";
  if (bmi < 25) return "Normal";
  if (bmi < 30) return "Overweight";
  return "Obese";
};

// Healthy body-fat ranges (rough ACE guidance) used for the composite score.
const healthyFatRange = (gender: string): [number, number] =>
  gender === "female" ? [21, 33] : [14, 25];

export const computeFitness = (input: BodyInput): FitnessComputation => {
  const { gender, age, heightCm, weightKg, activityLevel, goal } = input;
  const heightM = heightCm / 100;

  const bmi = weightKg / (heightM * heightM);
  const bmiCategory = bmiCategoryOf(bmi);

  // Mifflin-St Jeor
  const bmrBase = 10 * weightKg + 6.25 * heightCm - 5 * age;
  const bmr = gender === "male" ? bmrBase + 5 : bmrBase - 161;

  const multiplier = ACTIVITY_MULTIPLIERS[activityLevel] ?? 1.55;
  const tdee = bmr * multiplier;

  // Goal-adjusted target calories
  let targetCalories = tdee;
  if (goal === "cut") targetCalories = tdee - 500;
  else if (goal === "bulk") targetCalories = tdee + 400;

  // Ideal weight range for the healthy BMI window (18.5 - 24.9)
  const idealWeightMinKg = 18.5 * heightM * heightM;
  const idealWeightMaxKg = 24.9 * heightM * heightM;

  // ---- Composite fitness score (0-100) ----
  // BMI component: 100 at the centre of the healthy range, decaying outward.
  const bmiCenter = 21.7;
  const bmiScore = Math.max(0, 100 - Math.abs(bmi - bmiCenter) * 8);

  // Body-fat component (only if provided), else fall back to BMI component.
  let fatScore = bmiScore;
  if (input.bodyFatPct != null && input.bodyFatPct > 0) {
    const [lo, hi] = healthyFatRange(gender);
    const center = (lo + hi) / 2;
    fatScore = Math.max(0, 100 - Math.abs(input.bodyFatPct - center) * 4);
  }

  // Waist component (only if provided): waist-to-height ratio < 0.5 is healthy.
  let waistScore = bmiScore;
  if (input.waistCm != null && input.waistCm > 0) {
    const whtr = input.waistCm / heightCm;
    waistScore = Math.max(0, 100 - Math.max(0, whtr - 0.5) * 400);
  }

  const hasFat = input.bodyFatPct != null && input.bodyFatPct > 0;
  const hasWaist = input.waistCm != null && input.waistCm > 0;
  const fitnessScore = round(
    hasFat && hasWaist
      ? bmiScore * 0.4 + fatScore * 0.4 + waistScore * 0.2
      : hasFat
        ? bmiScore * 0.5 + fatScore * 0.5
        : hasWaist
          ? bmiScore * 0.6 + waistScore * 0.4
          : bmiScore
  );

  let fitnessLevel = "Needs Work";
  if (fitnessScore >= 85) fitnessLevel = "Athletic";
  else if (fitnessScore >= 70) fitnessLevel = "Fit";
  else if (fitnessScore >= 50) fitnessLevel = "Average";

  return {
    bmi: round(bmi, 1),
    bmiCategory,
    bmr: round(bmr),
    tdee: round(tdee),
    targetCalories: round(targetCalories),
    idealWeightMinKg: round(idealWeightMinKg, 1),
    idealWeightMaxKg: round(idealWeightMaxKg, 1),
    fitnessLevel,
    fitnessScore,
  };
};
