import { Hono } from "hono";
import { authController, signupSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema } from "../controllers/authController";
import { validate } from "../middlewares/validate";
import { Env } from "../utils/db";

export const authRouter = new Hono<{ Bindings: Env }>();

const { signup, login, refresh, logout, forgotPassword, resetPassword } = authController;

authRouter.post("/signup", validate(signupSchema), signup);
authRouter.post("/login", validate(loginSchema), login);
authRouter.post("/refresh", refresh);
authRouter.post("/logout", logout);
authRouter.post("/forgot-password", validate(forgotPasswordSchema), forgotPassword);
authRouter.post("/reset-password/:resetToken", validate(resetPasswordSchema), resetPassword);
