import jwt from "jsonwebtoken";
import { Context } from "hono";
import { setCookie, deleteCookie } from "hono/cookie";
import { Env } from "./db";

export const generateAccessToken = (userId: string, env: Env): string => {
  return jwt.sign({ id: userId }, env.JWT_SECRET || "default_secret", {
    expiresIn: "12h",
  });
};

export const generateRefreshToken = (userId: string, env: Env): string => {
  return jwt.sign(
    { id: userId },
    env.JWT_REFRESH_SECRET || "default_refresh_secret",
    {
      expiresIn: "7d",
    }
  );
};

export const setAuthCookies = (c: Context, accessToken: string, refreshToken: string, rememberMe: boolean = true) => {
  setCookie(c, "accessToken", accessToken, {
    httpOnly: true,
    secure: true, // Required for SameSite=None
    sameSite: "None", // Allows cross-domain AJAX cookies from workers.dev to vercel.app
    maxAge: 12 * 60 * 60, // 12 hours in seconds
    path: "/",
  });

  const refreshTokenOptions: any = {
    httpOnly: true,
    secure: true,
    sameSite: "None",
    path: "/",
  };

  if (rememberMe) {
    refreshTokenOptions.maxAge = 7 * 24 * 60 * 60; // 7 days in seconds
  }

  setCookie(c, "refreshToken", refreshToken, refreshTokenOptions);
};

export const clearAuthCookies = (c: Context) => {
  deleteCookie(c, "accessToken", { path: "/", httpOnly: true, secure: true, sameSite: "None" });
  deleteCookie(c, "refreshToken", { path: "/", httpOnly: true, secure: true, sameSite: "None" });
};
