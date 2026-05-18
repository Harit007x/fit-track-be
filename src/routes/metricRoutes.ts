import express from "express";
import { metricController, upsertMetricSchema, getHistorySchema } from "../controllers/metricController";
import { protect } from "../middlewares/authMiddleware";
import { validate } from "../middlewares/validate";

export const metricRouter = express.Router();

const { upsertMetric, getHistory, getTodayMetric } = metricController;

// All routes are protected
metricRouter.use(protect);

/**
 * @openapi
 * /metrics/today:
 *   get:
 *     summary: Get today's metrics for the logged-in user
 *     tags: [Metrics]
 *     responses:
 *       200:
 *         description: Success
 */
metricRouter.get("/today", getTodayMetric);

/**
 * @openapi
 * /metrics:
 *   post:
 *     summary: Create or update metrics for a specific date
 *     tags: [Metrics]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [date]
 *             properties:
 *               date: { type: string, example: "2026-05-11" }
 *               calories: { type: number }
 *               protein: { type: number }
 *               waterGlasses: { type: number }
 *               steps: { type: number }
 *               distanceKm: { type: number }
 *     responses:
 *       200:
 *         description: Success
 */
metricRouter.post("/", validate(upsertMetricSchema), upsertMetric);

/**
 * @openapi
 * /metrics/history:
 *   get:
 *     summary: Get historical metrics within a date range
 *     tags: [Metrics]
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema: { type: string }
 *       - in: query
 *         name: endDate
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Success
 */
metricRouter.get("/history", validate(getHistorySchema), getHistory);
