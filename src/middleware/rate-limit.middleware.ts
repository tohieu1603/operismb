/**
 * Rate Limiting Middleware
 * Prevents brute-force attacks on sensitive endpoints
 */

import rateLimit from "express-rate-limit";
import { MSG } from "../constants/messages";

/** Strict limit for login: 10 attempts per 15 minutes per IP */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: MSG.RATE_LIMIT_LOGIN, code: "RATE_LIMITED" },
});

/** Registration: 5 accounts per hour per IP */
export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: MSG.RATE_LIMIT_REGISTER, code: "RATE_LIMITED" },
});

/** Password change: 5 attempts per 15 minutes per IP */
export const passwordChangeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: MSG.RATE_LIMIT_PASSWORD, code: "RATE_LIMITED" },
});

/** General API: 200 requests per minute per IP */
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: MSG.RATE_LIMIT_GENERAL, code: "RATE_LIMITED" },
});
