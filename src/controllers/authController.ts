import { Context } from "hono";
import { getCookie } from "hono/cookie";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { z } from "zod";
import { getPrisma, Env } from "../utils/db";
import { generateAccessToken, generateRefreshToken, setAuthCookies, clearAuthCookies } from "../utils/auth";
import jwt from "jsonwebtoken";

export const signupSchema = z.object({
  body: z.object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    email: z.string().email("Invalid email"),
    password: z.string().min(6, "Password must be at least 6 characters"),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email("Invalid email"),
    password: z.string().min(1, "Password is required"),
    rememberMe: z.boolean().optional(),
  }),
});

export const forgotPasswordSchema = z.object({
  body: z.object({
    email: z.string().email("Invalid email"),
  }),
});

export const resetPasswordSchema = z.object({
  body: z.object({
    password: z.string().min(6, "Password must be at least 6 characters"),
  }),
  params: z.object({
    resetToken: z.string().min(1, "Reset token is required"),
  }),
});

const signup = async (c: Context<{ Bindings: Env }>) => {
  try {
    const { name, email, password } = await c.req.json();
    const prisma = getPrisma(c.env);

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return c.json({ success: false, message: "User already exists" }, 400);
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await prisma.user.create({
      data: { name, email, password: hashedPassword },
    });

    const accessToken = generateAccessToken(user.id, c.env);
    const refreshToken = generateRefreshToken(user.id, c.env);

    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    setAuthCookies(c, accessToken, refreshToken);

    return c.json(
      {
        success: true,
        data: { id: user.id, name: user.name, email: user.email },
        accessToken,
      },
      201
    );
  } catch (error) {
    console.error("Signup Error:", error);
    return c.json({ success: false, message: "Internal server error during signup" }, 500);
  }
};

const login = async (c: Context<{ Bindings: Env }>) => {
  try {
    const { email, password, rememberMe } = await c.req.json();
    const prisma = getPrisma(c.env);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return c.json({ success: false, message: "Invalid credentials" }, 401);
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return c.json({ success: false, message: "Invalid credentials" }, 401);
    }

    const accessToken = generateAccessToken(user.id, c.env);
    const refreshToken = generateRefreshToken(user.id, c.env);

    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    setAuthCookies(c, accessToken, refreshToken, rememberMe);

    return c.json({
      success: true,
      data: { id: user.id, name: user.name, email: user.email },
      accessToken,
    });
  } catch (error) {
    console.error("Login Error:", error);
    return c.json({ success: false, message: "Internal server error during login" }, 500);
  }
};

const refresh = async (c: Context<{ Bindings: Env }>) => {
  const incomingRefreshToken = getCookie(c, "refreshToken");

  if (!incomingRefreshToken) {
    return c.json({ success: false, message: "Refresh token not found" }, 401);
  }

  try {
    const decoded = jwt.verify(
      incomingRefreshToken,
      c.env.JWT_REFRESH_SECRET || "default_refresh_secret"
    ) as { id: string };

    const prisma = getPrisma(c.env);
    const storedToken = await prisma.refreshToken.findUnique({
      where: { token: incomingRefreshToken },
    });

    if (!storedToken) {
      return c.json({ success: false, message: "Invalid refresh token" }, 401);
    }

    const newAccessToken = generateAccessToken(decoded.id, c.env);
    const newRefreshToken = generateRefreshToken(decoded.id, c.env);

    await prisma.refreshToken.delete({ where: { id: storedToken.id } });
    await prisma.refreshToken.create({
      data: {
        token: newRefreshToken,
        userId: decoded.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    setAuthCookies(c, newAccessToken, newRefreshToken);

    return c.json({ success: true, accessToken: newAccessToken });
  } catch (error) {
    return c.json({ success: false, message: "Invalid refresh token" }, 401);
  }
};

const logout = async (c: Context<{ Bindings: Env }>) => {
  try {
    const refreshToken = getCookie(c, "refreshToken");
    let accessToken = getCookie(c, "accessToken");

    if (!accessToken && c.req.header("authorization")?.startsWith("Bearer")) {
      accessToken = c.req.header("authorization")?.split(" ")[1];
    }

    const prisma = getPrisma(c.env);

    if (refreshToken) {
      await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
    }

    if (accessToken) {
      try {
        const decoded = jwt.decode(accessToken) as jwt.JwtPayload;
        if (decoded && decoded.exp) {
          await prisma.blacklistedToken.create({
            data: {
              token: accessToken,
              expiresAt: new Date(decoded.exp * 1000),
            },
          });
        }
      } catch (e) {
        // Ignored
      }
    }

    clearAuthCookies(c);
    return c.json({ success: true, message: "Logged out" });
  } catch (error) {
    return c.json({ success: false, message: "Internal server error during logout" }, 500);
  }
};

const forgotPassword = async (c: Context<{ Bindings: Env }>) => {
  try {
    const { email } = await c.req.json();
    const prisma = getPrisma(c.env);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return c.json({ success: false, message: "User not found" }, 404);
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto.createHash("sha256").update(resetToken).digest("hex");

    await prisma.user.update({
      where: { email },
      data: {
        resetPasswordToken: hashedToken,
        resetPasswordExpire: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    const resetUrl = `${c.env.FRONTEND_URL || "http://localhost:5173"}/reset-password/${resetToken}`;
    console.log(`[Email Mock] Password reset URL for ${user.email}: \n${resetUrl}`);

    return c.json({
      success: true,
      message: "Password reset link generated. Check console.",
      ...(process.env.NODE_ENV !== "production" && { resetUrl }),
    });
  } catch (error) {
    return c.json({ success: false, message: "Internal server error" }, 500);
  }
};

const resetPassword = async (c: Context<{ Bindings: Env }>) => {
  try {
    const resetToken = c.req.param("resetToken");
    const { password } = await c.req.json();
    const prisma = getPrisma(c.env);

    const hashedToken = crypto.createHash("sha256").update(String(resetToken)).digest("hex");

    const user = await prisma.user.findFirst({
      where: {
        resetPasswordToken: hashedToken,
        resetPasswordExpire: { gt: new Date() },
      },
    });

    if (!user) {
      return c.json({ success: false, message: "Invalid or expired token" }, 400);
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetPasswordToken: null,
        resetPasswordExpire: null,
      },
    });

    await prisma.refreshToken.deleteMany({ where: { userId: user.id } });

    return c.json({ success: true, message: "Password reset successfully" });
  } catch (error) {
    return c.json({ success: false, message: "Internal server error" }, 500);
  }
};

export const authController = {
  signup,
  login,
  refresh,
  logout,
  forgotPassword,
  resetPassword,
};
