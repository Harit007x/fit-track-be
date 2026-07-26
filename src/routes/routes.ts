import express from "express";
import { dummyController } from "../controllers/dummyController";
import { authRouter } from "./authRoutes";
import { metricRouter } from "./metricRoutes";
import { bodyRouter } from "./bodyRoutes";

export const router = express.Router();

const { fetchAllTodo } = dummyController;

/**
 * @openapi
 * /todos:
 *   get:
 *     summary: Fetch all todos (Dummy endpoint)
 *     tags: [General]
 *     responses:
 *       200:
 *         description: List of todos returned successfully
 */
router.get("/todos", fetchAllTodo);
router.use("/auth", authRouter);
router.use("/metrics", metricRouter);
router.use("/body", bodyRouter);
