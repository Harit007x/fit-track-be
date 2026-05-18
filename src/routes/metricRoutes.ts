import { Hono } from "hono";
import { metricController, upsertMetricSchema, getHistorySchema } from "../controllers/metricController";
import { protect } from "../middlewares/authMiddleware";
import { validate } from "../middlewares/validate";
import { Env } from "../utils/db";

export const metricRouter = new Hono<{ Bindings: Env; Variables: { user: any } }>();

const { upsertMetric, getHistory, getTodayMetric } = metricController;

metricRouter.use("*", protect);

metricRouter.get("/today", getTodayMetric);
metricRouter.post("/", validate(upsertMetricSchema), upsertMetric);
metricRouter.get("/history", validate(getHistorySchema), getHistory);
