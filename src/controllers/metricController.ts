import { Context } from "hono";
import { getPrisma, Env } from "../utils/db";
import { z } from "zod";

export const upsertMetricSchema = z.object({
  body: z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)"),
    calories: z.number().nonnegative().optional(),
    protein: z.number().nonnegative().optional(),
    waterGlasses: z.number().nonnegative().optional(),
    steps: z.number().nonnegative().optional(),
    distanceKm: z.number().nonnegative().optional(),
  }),
});

export const getHistorySchema = z.object({
  query: z.object({
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format").optional(),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format").optional(),
  }),
});

const upsertMetric = async (c: Context<{ Bindings: Env; Variables: { user: any } }>) => {
  try {
    const userId = c.get("user").id;
    const { date, ...metrics } = await c.req.json();
    const prisma = getPrisma(c.env);

    // In SQLite, composite unique where is structured identical to standard prisma
    const metric = await prisma.dailyMetric.upsert({
      where: {
        userId_date: {
          userId,
          date,
        },
      },
      update: metrics,
      create: {
        userId,
        date,
        ...metrics,
      },
    });

    return c.json({ success: true, data: metric });
  } catch (error) {
    console.error("Upsert Metric Error:", error);
    return c.json({ success: false, message: "Failed to update metrics" }, 500);
  }
};

const getHistory = async (c: Context<{ Bindings: Env; Variables: { user: any } }>) => {
  try {
    const userId = c.get("user").id;
    const { startDate, endDate } = c.req.query();
    const prisma = getPrisma(c.env);

    const metrics = await prisma.dailyMetric.findMany({
      where: {
        userId,
        ...(startDate && endDate ? {
          date: {
            gte: startDate,
            lte: endDate,
          },
        } : {}),
      },
      orderBy: {
        date: "asc",
      },
    });

    return c.json({ success: true, data: metrics });
  } catch (error) {
    console.error("Get History Error:", error);
    return c.json({ success: false, message: "Failed to fetch history" }, 500);
  }
};

const getTodayMetric = async (c: Context<{ Bindings: Env; Variables: { user: any } }>) => {
  try {
    const userId = c.get("user").id;
    const today = new Date().toISOString().split("T")[0];
    const prisma = getPrisma(c.env);

    const metric = await prisma.dailyMetric.findUnique({
      where: {
        userId_date: {
          userId,
          date: today,
        },
      },
    });

    return c.json({ success: true, data: metric });
  } catch (error) {
    console.error("Get Today Metric Error:", error);
    return c.json({ success: false, message: "Failed to fetch today's metrics" }, 500);
  }
};

export const metricController = {
  upsertMetric,
  getHistory,
  getTodayMetric,
};
