import { Request, Response } from "express";
import { prisma } from "../utils/db";
import { z } from "zod";

// Validation Schemas
export const upsertMetricSchema = z.object({
  body: z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)"),
    calories: z.number().nonnegative().optional(),
    caloriesBurned: z.number().nonnegative().optional(),
    protein: z.number().nonnegative().optional(),
    waterGlasses: z.number().nonnegative().optional(),
    steps: z.number().nonnegative().optional(),
  }),
});

export const getHistorySchema = z.object({
  query: z.object({
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format").optional(),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format").optional(),
  }),
});

// Controllers
const upsertMetric = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const { date, ...metrics } = req.body;

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

    res.status(200).json({ success: true, data: metric });
  } catch (error) {
    console.error("Upsert Metric Error:", error);
    res.status(500).json({ success: false, message: "Failed to update metrics" });
  }
};

const getHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const { startDate, endDate } = req.query;

    const metrics = await prisma.dailyMetric.findMany({
      where: {
        userId,
        date: {
          gte: startDate as string,
          lte: endDate as string,
        },
      },
      orderBy: {
        date: "asc",
      },
    });

    res.status(200).json({ success: true, data: metrics });
  } catch (error) {
    console.error("Get History Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch history" });
  }
};

const getTodayMetric = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const today = new Date().toISOString().split("T")[0];

    const metric = await prisma.dailyMetric.findUnique({
      where: {
        userId_date: {
          userId,
          date: today,
        },
      },
    });

    res.status(200).json({ success: true, data: metric });
  } catch (error) {
    console.error("Get Today Metric Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch today's metrics" });
  }
};

export const metricController = {
  upsertMetric,
  getHistory,
  getTodayMetric,
};
