/**
 * Question Controller - Product Q&A
 */

import type { Request, Response, NextFunction } from "express";
import { questionService } from "../services/question.service.js";

export async function getProductQuestions(req: Request, res: Response, next: NextFunction) {
  try {
    const limit = Math.min(parseInt(String(req.query.limit ?? "20"), 10), 100);
    const offset = parseInt(String(req.query.offset ?? "0"), 10);

    const result = await questionService.getProductQuestions(req.params.slug, limit, offset);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function askQuestion(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const { content } = req.body;

    const question = await questionService.askQuestion(userId, req.params.slug, content);
    res.status(201).json(question);
  } catch (error) {
    next(error);
  }
}

export async function answerQuestion(req: Request, res: Response, next: NextFunction) {
  try {
    const adminName = req.user!.email.split("@")[0];
    const { content } = req.body;

    const question = await questionService.answerQuestion(req.params.id, adminName, content);
    res.json(question);
  } catch (error) {
    next(error);
  }
}
