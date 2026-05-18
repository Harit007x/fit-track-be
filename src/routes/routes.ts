import { Hono } from "hono";
import { dummyController } from "../controllers/dummyController";
import { authRouter } from "./authRoutes";
import { metricRouter } from "./metricRoutes";
import { Env } from "../utils/db";

export const router = new Hono<{ Bindings: Env }>();

const { fetchAllTodo } = dummyController;

router.get("/todos", fetchAllTodo);
router.route("/auth", authRouter);
router.route("/metrics", metricRouter);
