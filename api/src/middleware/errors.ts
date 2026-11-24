// Turns every error into the same JSON shape:
//   { "error": { "code": "not_found", "message": "Room not found" } }
// Express 5 passes errors from async route handlers here automatically.
import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError, z } from "zod";

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export const notFound: RequestHandler = (req, _res, next) => {
  next(new HttpError(404, "not_found", `No route for ${req.method} ${req.path}`));
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message } });
    return;
  }
  if (err instanceof ZodError) {
    res.status(400).json({
      error: { code: "invalid_input", message: "Some fields are invalid", fields: z.flattenError(err).fieldErrors },
    });
    return;
  }
  // Body that is not valid JSON.
  if (err?.type === "entity.parse.failed") {
    res.status(400).json({ error: { code: "invalid_json", message: "Request body is not valid JSON" } });
    return;
  }
  console.error(err);
  res.status(500).json({ error: { code: "server_error", message: "Something went wrong" } });
};
