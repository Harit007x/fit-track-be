import { Request, Response } from "express";
import { prisma } from "../utils/db";
import { z } from "zod";
import { computeFitness } from "../utils/fitness";
import { generateDietPlanText, parseJsonFromModel } from "../utils/gemini";

// ---------------------- Validation ----------------------
const optionalPositive = z.number().positive().max(500).optional().nullable();

export const upsertBodyProfileSchema = z.object({
  body: z.object({
    gender: z.enum(["male", "female"]),
    age: z.number().int().positive().max(120),
    heightCm: z.number().positive().max(300),
    weightKg: z.number().positive().max(600),

    bodyFatPct: z.number().positive().max(80).optional().nullable(),
    neckCm: optionalPositive,
    chestCm: optionalPositive,
    waistCm: optionalPositive,
    hipsCm: optionalPositive,
    bicepsCm: optionalPositive,
    thighCm: optionalPositive,

    activityLevel: z.enum(["sedentary", "light", "moderate", "active", "athlete"]),
    goal: z.enum(["cut", "maintain", "bulk"]),
    dietType: z.enum(["veg", "non-veg", "vegan", "eggetarian"]),
    foodStyle: z.enum(["accessible", "balanced", "gourmet"]).optional(),
    allergies: z.string().max(500).optional().nullable(),
  }),
});

// ---------------------- Helpers ----------------------
const DIET_TYPE_RULES: Record<string, string> = {
  veg: "STRICTLY VEGETARIAN. Absolutely NO meat, poultry, fish, seafood, or EGGS of any kind (this explicitly includes boiled eggs, egg whites, omelettes, and egg-based products). Dairy (milk, yogurt, paneer, cheese, ghee) and all plant foods ARE allowed.",
  eggetarian: "EGGETARIAN. Vegetarian PLUS eggs are allowed. NO meat, poultry, fish, or seafood.",
  vegan: "STRICTLY VEGAN. NO animal products whatsoever — no meat, poultry, fish, seafood, eggs, dairy (milk/cheese/yogurt/paneer/ghee/butter), honey, or gelatin. Plant-based foods ONLY.",
  "non-veg": "NON-VEGETARIAN. All foods are allowed, including meat, poultry, fish, seafood, and eggs.",
};

const FOOD_STYLE_GUIDANCE: Record<string, string> = {
  accessible:
    "Use only everyday, budget-friendly, widely-available whole foods and pantry staples (e.g. eggs, oats, rice, lentils, chicken, seasonal vegetables, bananas, milk, yogurt). Avoid rare, imported, or specialty ingredients. Keep recipes simple and quick to prepare.",
  balanced:
    "Use mostly common, easy-to-find ingredients, but a few slightly premium or specialty items (e.g. Greek yogurt, salmon, quinoa, berries) are acceptable when they add clear value.",
  gourmet:
    "A refined, restaurant-style plan is welcome. Premium, specialty, or exotic ingredients and more elaborate preparations are acceptable as long as the macros and goal are met.",
};

const profileToInput = (p: any) => ({
  gender: p.gender,
  age: p.age,
  heightCm: p.heightCm,
  weightKg: p.weightKg,
  bodyFatPct: p.bodyFatPct,
  waistCm: p.waistCm,
  activityLevel: p.activityLevel,
  goal: p.goal,
});

// ---------------------- Controllers ----------------------
const getProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const profile = await prisma.bodyProfile.findUnique({ where: { userId } });

    if (!profile) {
      res.status(200).json({ success: true, data: null });
      return;
    }

    const fitness = computeFitness(profileToInput(profile));
    res.status(200).json({ success: true, data: { profile, fitness } });
  } catch (error) {
    console.error("Get Body Profile Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch body profile" });
  }
};

const upsertProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const data = req.body;

    const profile = await prisma.bodyProfile.upsert({
      where: { userId },
      update: data,
      create: { userId, ...data },
    });

    const fitness = computeFitness(profileToInput(profile));
    res.status(200).json({ success: true, data: { profile, fitness } });
  } catch (error) {
    console.error("Upsert Body Profile Error:", error);
    res.status(500).json({ success: false, message: "Failed to save body profile" });
  }
};

const generateDietPlan = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const profile = await prisma.bodyProfile.findUnique({ where: { userId } });

    if (!profile) {
      res.status(400).json({ success: false, message: "Save your body metrics before generating a plan" });
      return;
    }

    if (!process.env.GEMINI_API_KEY) {
      res.status(503).json({ success: false, message: "AI diet planning is not configured on the server" });
      return;
    }

    // Daily limit: one diet plan generation per calendar day (UTC) per user.
    if (profile.planGeneratedAt) {
      const lastDay = profile.planGeneratedAt.toISOString().split("T")[0];
      const today = new Date().toISOString().split("T")[0];
      if (lastDay === today) {
        res.status(429).json({
          success: false,
          message: "Daily limit reached — you can generate one diet plan per day. Please try again tomorrow.",
        });
        return;
      }
    }

    const fitness = computeFitness(profileToInput(profile));

    const foodStyle = profile.foodStyle || "accessible";
    const foodStyleGuidance = FOOD_STYLE_GUIDANCE[foodStyle] || FOOD_STYLE_GUIDANCE.accessible;
    const dietRule = DIET_TYPE_RULES[profile.dietType] || DIET_TYPE_RULES.veg;

    const system = [
      "You are a certified sports nutritionist creating a practical one-day diet plan.",
      "Every value the user provides is a HARD CONSTRAINT. You must honor ALL of them: gender, age, weight, activity level, goal, diet type, ingredient style, and allergies. Do not violate any of them.",
      `DIET TYPE RULE (must NEVER be violated for any meal, snack, or item): ${dietRule}`,
      "Before finalising, re-check every single food item — including snacks — against the diet type rule and the allergy list, and remove or replace anything that is not allowed.",
      "NEVER include a food the user is allergic to. If you are unsure whether an item is permitted, do not include it.",
      `Ingredient availability requirement: ${foodStyleGuidance}`,
      "Hit the target daily calories within +/- 5% and prioritise adequate protein.",
      "Respond with ONLY a JSON object, no markdown, matching exactly this shape:",
      `{
  "summary": string,                       // 1-2 sentence overview tailored to the user's goal
  "targetCalories": number,                // integer kcal for the day
  "macros": { "proteinG": number, "carbsG": number, "fatG": number },
  "meals": [
    { "name": string,                      // e.g. "Breakfast"
      "items": [ { "food": string, "quantity": string, "calories": number } ],
      "calories": number }
  ],
  "hydrationLiters": number,
  "tips": [ string ]                       // 3-5 short actionable tips
}`,
    ].join("\n");

    const prompt = [
      `Gender: ${profile.gender}`,
      `Age: ${profile.age}`,
      `Height: ${profile.heightCm} cm`,
      `Weight: ${profile.weightKg} kg`,
      profile.bodyFatPct ? `Body fat: ${profile.bodyFatPct}%` : null,
      profile.waistCm ? `Waist: ${profile.waistCm} cm` : null,
      `Activity level: ${profile.activityLevel}`,
      `Goal: ${profile.goal}`,
      `Diet type: ${profile.dietType} — ${dietRule}`,
      `Ingredient style: ${foodStyle}`,
      `Allergies / foods to avoid: ${profile.allergies || "none"}`,
      "",
      `Computed BMI: ${fitness.bmi} (${fitness.bmiCategory})`,
      `Computed maintenance (TDEE): ${fitness.tdee} kcal`,
      `Target daily calories for this goal: ${fitness.targetCalories} kcal`,
      "",
      "Create the one-day diet plan now as JSON only.",
    ]
      .filter(Boolean)
      .join("\n");

    const raw = await generateDietPlanText(system, prompt);
    const plan = parseJsonFromModel(raw);

    const updated = await prisma.bodyProfile.update({
      where: { userId },
      data: { dietPlan: plan, planGeneratedAt: new Date() },
    });

    res.status(200).json({
      success: true,
      data: { dietPlan: plan, planGeneratedAt: updated.planGeneratedAt, fitness },
    });
  } catch (error: any) {
    console.error("Generate Diet Plan Error:", error);
    res.status(502).json({
      success: false,
      message: error?.message?.includes("GEMINI_API_KEY")
        ? "AI diet planning is not configured on the server"
        : "Failed to generate diet plan. Please try again.",
    });
  }
};

export const bodyController = {
  getProfile,
  upsertProfile,
  generateDietPlan,
};
