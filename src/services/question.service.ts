/**
 * Question Service - Product Q&A
 */

import { Errors } from "../core/errors/api-error.js";
import { questionsRepo, productsRepo, usersRepo } from "../db/index.js";
import type { QuestionWithAnswers } from "../db/models/questions.js";

class QuestionService {
  async getProductQuestions(
    productSlug: string,
    limit = 20,
    offset = 0,
  ): Promise<{ questions: QuestionWithAnswers[]; total: number }> {
    const result = await questionsRepo.getQuestionsByProduct(productSlug, limit, offset);

    // Batch-load answers for all questions
    const questionIds = result.questions.map((q) => q.id);
    const allAnswers = await questionsRepo.getAnswersForQuestions(questionIds);

    const questions: QuestionWithAnswers[] = result.questions.map((q) => ({
      ...q,
      answers: allAnswers.filter((a) => a.question_id === q.id),
    }));

    return { questions, total: result.total };
  }

  async askQuestion(
    userId: string,
    productSlug: string,
    content: string,
  ): Promise<QuestionWithAnswers> {
    // Check product exists
    const product = await productsRepo.getProductBySlug(productSlug);
    if (!product) throw Errors.notFound("Product");

    if (!content.trim()) throw Errors.badRequest("Question content is required");

    // Get user name for author
    const user = await usersRepo.getUserById(userId);
    if (!user) throw Errors.notFound("User");

    const question = await questionsRepo.createQuestion({
      product_slug: productSlug,
      user_id: userId,
      author: user.name || user.email.split("@")[0],
      content: content.trim(),
    });

    return { ...question, answers: [] };
  }

  async answerQuestion(
    questionId: string,
    adminName: string,
    content: string,
  ): Promise<QuestionWithAnswers> {
    const question = await questionsRepo.getQuestionById(questionId);
    if (!question) throw Errors.notFound("Question");

    if (!content.trim()) throw Errors.badRequest("Answer content is required");

    await questionsRepo.createAnswer({
      question_id: questionId,
      author: adminName,
      content: content.trim(),
    });

    const answers = await questionsRepo.getAnswersForQuestion(questionId);
    return { ...question, answers };
  }
}

export const questionService = new QuestionService();
