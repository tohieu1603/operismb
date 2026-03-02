/**
 * Cookie utilities for HttpOnly JWT token management.
 * Centralizes cookie names, flags, and set/clear helpers.
 */

import type { CookieOptions, Response } from "express";

// Cookie names
export const ACCESS_COOKIE = "operis_access";
export const REFRESH_COOKIE = "operis_refresh";

// Durations (must match jwt.util.ts)
const ACCESS_MAX_AGE_MS = 60 * 60 * 1000; // 1 hour
const REFRESH_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// Secure cookies when production OR explicitly enabled (for HTTPS behind reverse proxy)
const useSecureCookies =
  process.env.NODE_ENV === "production" ||
  process.env.COOKIE_SECURE === "true";

function baseCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: useSecureCookies,
    // "none" + secure for cross-origin; "lax" for same-origin dev
    sameSite: useSecureCookies ? "none" : "lax",
  };
}

/** Set HttpOnly access + refresh cookies on the response */
export function setAuthCookies(res: Response, accessToken: string, refreshToken: string): void {
  res.cookie(ACCESS_COOKIE, accessToken, {
    ...baseCookieOptions(),
    path: "/",
    maxAge: ACCESS_MAX_AGE_MS,
  });

  // Refresh cookie scoped to /api/auth/refresh only
  res.cookie(REFRESH_COOKIE, refreshToken, {
    ...baseCookieOptions(),
    path: "/api/auth/refresh",
    maxAge: REFRESH_MAX_AGE_MS,
  });
}

/** Clear both auth cookies */
export function clearAuthCookies(res: Response): void {
  const base = baseCookieOptions();
  res.clearCookie(ACCESS_COOKIE, { ...base, path: "/" });
  res.clearCookie(REFRESH_COOKIE, { ...base, path: "/api/auth/refresh" });
}
