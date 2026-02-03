/**
 * Validation Middleware
 * Validates request body/params using validator functions
 */

import type { Request, Response, NextFunction } from "express";
import { Errors } from "../core/errors/api-error.js";
import type { ValidationResult } from "../validators/common.validator.js";

type ValidatorFn<T> = (data: unknown) => ValidationResult<T>;

/**
 * Creates middleware that validates request body
 * Stores validated data in req.body (typed)
 */
export function validateBody<T>(validator: ValidatorFn<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = validator(req.body);
    if (!result.valid) {
      next(Errors.validation(result.errors.join(", ")));
      return;
    }
    req.body = result.data;
    next();
  };
}

/**
 * Creates middleware that validates query params
 */
export function validateQuery<T>(validator: ValidatorFn<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = validator(req.query);
    if (!result.valid) {
      next(Errors.validation(result.errors.join(", ")));
      return;
    }
    (req as Request & { validatedQuery: T }).validatedQuery = result.data;
    next();
  };
}

/**
 * Creates middleware that validates route params
 */
export function validateParams<T>(validator: ValidatorFn<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = validator(req.params);
    if (!result.valid) {
      next(Errors.validation(result.errors.join(", ")));
      return;
    }
    (req as Request & { validatedParams: T }).validatedParams = result.data;
    next();
  };
}
