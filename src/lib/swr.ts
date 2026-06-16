"use client";

import { apiFetch } from "@/lib/client";

/** Default SWR fetcher for same-origin JSON API routes. */
export const fetcher = <T = unknown>(url: string) => apiFetch<T>(url);
