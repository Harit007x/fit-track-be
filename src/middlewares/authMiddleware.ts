import { Context, Next } from "hono";
import { getCookie } from "hono/cookie";
import jwt from "jsonwebtoken";
import { getPrisma, Env } from "../utils/db";

interface JwtPayload {
  id: string;
}

export const protect = async (c: Context<{ Bindings: Env; Variables: { user: any } }>, next: Next): Promise<Response | void> => {
  let token;

  const accessTokenCookie = getCookie(c, "accessToken");
  if (accessTokenCookie) {
    token = accessTokenCookie;
  } else {
    const authHeader = c.req.header("authorization");
    if (authHeader && authHeader.startsWith("Bearer")) {
      token = authHeader.split(" ")[1];
    }
  }

  if (!token) {
    return c.json({ success: false, message: "Not authorized to access this route" }, 401);
  }

  try {
    const prisma = getPrisma(c.env);

    const isBlacklisted = await prisma.blacklistedToken.findUnique({
      where: { token },
    });

    if (isBlacklisted) {
      return c.json({ success: false, message: "Token has been revoked" }, 401);
    }

    const decoded = jwt.verify(token, c.env.JWT_SECRET || "default_secret") as JwtPayload;

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, name: true, email: true },
    });

    if (!user) {
      return c.json({ success: false, message: "User belonging to this token no longer exists" }, 401);
    }

    c.set("user", user);
    await next();
  } catch (error) {
    return c.json({ success: false, message: "Not authorized to access this route" }, 401);
  }
};
