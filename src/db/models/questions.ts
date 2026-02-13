/**
 * Questions Repository
 * CRUD for questions + question_answers tables
 */

import { queryOne, queryAll } from "../connection";

// ── Types ───────────────────────────────────────────────────────────────

export interface Question {
  id: string;
  product_slug: string;
  user_id: string | null;
  author: string;
  content: string;
  created_at: Date;
}

export interface QuestionAnswer {
  id: string;
  question_id: string;
  author: string;
  content: string;
  created_at: Date;
}

export interface QuestionWithAnswers extends Question {
  answers: QuestionAnswer[];
}

export interface QuestionCreate {
  product_slug: string;
  user_id?: string;
  author: string;
  content: string;
}

export interface AnswerCreate {
  question_id: string;
  author: string;
  content: string;
}

// ── Question CRUD ───────────────────────────────────────────────────────

export async function createQuestion(data: QuestionCreate): Promise<Question> {
  const result = await queryOne<Question>(
    `INSERT INTO questions (product_slug, user_id, author, content)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [data.product_slug, data.user_id ?? null, data.author, data.content],
  );
  if (!result) throw new Error("Failed to create question");
  return result;
}

export async function getQuestionsByProduct(
  productSlug: string,
  limit = 20,
  offset = 0,
): Promise<{ questions: Question[]; total: number }> {
  const countResult = await queryOne<{ count: string }>(
    "SELECT COUNT(*) as count FROM questions WHERE product_slug = $1",
    [productSlug],
  );

  const questions = await queryAll<Question>(
    "SELECT * FROM questions WHERE product_slug = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3",
    [productSlug, limit, offset],
  );

  return { questions, total: parseInt(countResult?.count ?? "0", 10) };
}

export async function getQuestionById(id: string): Promise<Question | null> {
  return queryOne<Question>("SELECT * FROM questions WHERE id = $1", [id]);
}

export async function getAnswersForQuestion(questionId: string): Promise<QuestionAnswer[]> {
  return queryAll<QuestionAnswer>(
    "SELECT * FROM question_answers WHERE question_id = $1 ORDER BY created_at ASC",
    [questionId],
  );
}

export async function getAnswersForQuestions(questionIds: string[]): Promise<QuestionAnswer[]> {
  if (!questionIds.length) return [];
  const placeholders = questionIds.map((_, i) => `$${i + 1}`).join(",");
  return queryAll<QuestionAnswer>(
    `SELECT * FROM question_answers WHERE question_id IN (${placeholders}) ORDER BY created_at ASC`,
    questionIds,
  );
}

export async function createAnswer(data: AnswerCreate): Promise<QuestionAnswer> {
  const result = await queryOne<QuestionAnswer>(
    `INSERT INTO question_answers (question_id, author, content)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [data.question_id, data.author, data.content],
  );
  if (!result) throw new Error("Failed to create answer");
  return result;
}

// ── Export ───────────────────────────────────────────────────────────────

export const questionsRepo = {
  createQuestion,
  getQuestionsByProduct,
  getQuestionById,
  getAnswersForQuestion,
  getAnswersForQuestions,
  createAnswer,
};

export default questionsRepo;
