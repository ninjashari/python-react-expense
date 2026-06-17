import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { UnauthorizedError } from "./auth";
import { OwnershipError } from "./transactions-service";
import { InsufficientPointsError } from "./rewards";
import { logger } from "./logger";

/** Pull the HTTP method and path off the first handler arg, if it's a Request. */
function describeRequest(args: unknown[]): { method?: string; path?: string } {
  const req = args[0];
  if (req instanceof Request) {
    try {
      return { method: req.method, path: new URL(req.url).pathname };
    } catch {
      return { method: req.method };
    }
  }
  return {};
}

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function created<T>(data: T) {
  return NextResponse.json(data, { status: 201 });
}

export function noContent() {
  return new NextResponse(null, { status: 204 });
}

export function fail(message: string, status = 400, extra?: unknown) {
  return NextResponse.json({ error: message, details: extra }, { status });
}

/** Wraps a route handler, translating known errors into JSON responses. */
export function route<A extends unknown[]>(
  fn: (...args: A) => Promise<NextResponse>,
) {
  return async (...args: A): Promise<NextResponse> => {
    const { method, path } = describeRequest(args);
    const start = Date.now();
    logger.info("request received", { method, path });
    try {
      const res = await fn(...args);
      logger.info("request completed", {
        method,
        path,
        status: res.status,
        durationMs: Date.now() - start,
      });
      return res;
    } catch (err) {
      const durationMs = Date.now() - start;
      if (err instanceof UnauthorizedError) {
        logger.info("request rejected", { method, path, status: 401, reason: "unauthorized", durationMs });
        return fail("Unauthorized", 401);
      }
      if (err instanceof ZodError) {
        logger.info("request rejected", { method, path, status: 422, reason: "validation", durationMs });
        return fail("Validation failed", 422, err.issues);
      }
      if (err instanceof OwnershipError) {
        logger.info("request rejected", { method, path, status: 422, reason: "ownership", durationMs });
        return fail(err.message, 422);
      }
      if (err instanceof InsufficientPointsError) {
        logger.info("request rejected", { method, path, status: 422, reason: "insufficient-points", durationMs });
        return fail(err.message, 422);
      }
      logger.error("request failed", {
        method,
        path,
        status: 500,
        durationMs,
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      });
      return fail("Internal server error", 500);
    }
  };
}
