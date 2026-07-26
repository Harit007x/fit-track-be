import express from "express";
import { bodyController, upsertBodyProfileSchema } from "../controllers/bodyController";
import { protect } from "../middlewares/authMiddleware";
import { validate } from "../middlewares/validate";

export const bodyRouter = express.Router();

const { getProfile, upsertProfile, generateDietPlan } = bodyController;

// All routes are protected
bodyRouter.use(protect);

/**
 * @openapi
 * /body:
 *   get:
 *     summary: Get the logged-in user's body profile + computed fitness
 *     tags: [Body]
 *     responses:
 *       200:
 *         description: Success
 */
bodyRouter.get("/", getProfile);

/**
 * @openapi
 * /body:
 *   post:
 *     summary: Create or update the user's body metrics and diet preferences
 *     tags: [Body]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [gender, age, heightCm, weightKg, activityLevel, goal, dietType]
 *             properties:
 *               gender: { type: string, enum: [male, female] }
 *               age: { type: number }
 *               heightCm: { type: number }
 *               weightKg: { type: number }
 *               bodyFatPct: { type: number }
 *               neckCm: { type: number }
 *               chestCm: { type: number }
 *               waistCm: { type: number }
 *               hipsCm: { type: number }
 *               bicepsCm: { type: number }
 *               thighCm: { type: number }
 *               activityLevel: { type: string, enum: [sedentary, light, moderate, active, athlete] }
 *               goal: { type: string, enum: [cut, maintain, bulk] }
 *               dietType: { type: string, enum: [veg, non-veg, vegan, eggetarian] }
 *               allergies: { type: string }
 *     responses:
 *       200:
 *         description: Success
 */
bodyRouter.post("/", validate(upsertBodyProfileSchema), upsertProfile);

/**
 * @openapi
 * /body/diet-plan:
 *   post:
 *     summary: Generate an AI diet plan from the saved body profile
 *     tags: [Body]
 *     responses:
 *       200:
 *         description: Success
 */
bodyRouter.post("/diet-plan", generateDietPlan);
