import { Context, Next } from "hono";
import { ZodTypeAny, ZodError } from "zod";

export const validate = (schema: ZodTypeAny) => {
  return async (c: Context, next: Next) => {
    try {
      let body = {};
      if (c.req.header("content-type")?.includes("application/json")) {
        body = await c.req.json().catch(() => ({}));
      }

      await schema.parseAsync({
        body,
        query: c.req.query(),
        params: c.req.param(),
      });
      await next();
    } catch (error) {
      if (error instanceof ZodError) {
        return c.json(
          {
            success: false,
            message: "Validation Error",
            errors: error.issues,
          },
          400
        );
      }
      return c.json({ success: false, message: "Invalid Request" }, 400);
    }
  };
};
