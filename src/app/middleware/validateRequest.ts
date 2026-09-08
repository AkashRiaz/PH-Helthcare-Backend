import z from "zod";
import { catchAsync } from "../utils/catchAsync";
import { NextFunction, Request, Response } from "express";

export const validateRequest = (ZodSchema: z.ZodSchema) => {
  return catchAsync((req: Request, res: Response, next: NextFunction) => {
    const payload = req.body ?? {};

    const result = ZodSchema.safeParse(payload);
    if (!result.success) {
      throw new Error(
        result.error.issues.map((issue) => issue.message).join(", "),
      );
    }

    req.body = result.data;
    next();
  });
};