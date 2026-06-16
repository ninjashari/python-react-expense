import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { UnauthorizedError } from "./auth";
import { OwnershipError } from "./transactions-service";

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
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        return fail("Unauthorized", 401);
      }
      if (err instanceof ZodError) {
        return fail("Validation failed", 422, err.issues);
      }
      if (err instanceof OwnershipError) {
        return fail(err.message, 422);
      }
      console.error("[route error]", err);
      return fail("Internal server error", 500);
    }
  };
}
