import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { router } from "./routes/routes";
import { errorHandler } from "./middlewares/errorHandler";
import { Env } from "./utils/db";

const app = new Hono<{ Bindings: Env }>();

app.use("*", logger());

app.use(
  "*",
  cors({
    origin: (origin) => origin || "*",
    allowHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    allowMethods: ["POST", "GET", "OPTIONS", "PUT", "DELETE", "PATCH"],
    maxAge: 86400,
    credentials: true,
  })
);

app.route("/api", router);

app.onError(errorHandler);

export default app;
