import { Context } from "hono";
import { ZodError } from "zod";

export const errorHandler = (err: Error, c: Context): Response => {
  if (process.env.NODE_ENV !== "production") {
    console.error("Path:", c.req.path);
    console.error("Error:", err);
  }

  if (err instanceof ZodError) {
    return c.json(
      {
        success: false,
        message: "Validation Error",
        errors: err.issues,
      },
      400
    );
  }

  if (err instanceof SyntaxError) {
    return c.json(
      {
        success: false,
        message: "Invalid format. Expected JSON.",
      },
      400
    );
  }

  const message = err.message || "Internal Server Error";

  return c.json(
    {
      success: false,
      message,
      ...(process.env.NODE_ENV !== "production" && { stack: err.stack }),
    },
    500
  );
};
