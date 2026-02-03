/**
 * Chat Routes
 * API endpoints for chat with AI
 */

import { Router } from "express";
import { chatController } from "../controllers/chat.controller.js";
import { authMiddleware, hybridAuthMiddleware, asyncHandler } from "../middleware/index.js";

const router = Router();

// Chat supports both JWT and API key auth
router.post(
  "/",
  asyncHandler(async (req, res, next) => {
    await hybridAuthMiddleware(req, res, next);
  }),
  asyncHandler((req, res) => chatController.sendMessage(req, res)),
);

// Balance check requires JWT
router.get(
  "/balance",
  authMiddleware,
  asyncHandler((req, res) => chatController.getBalance(req, res)),
);

// Get all conversations
router.get(
  "/conversations",
  authMiddleware,
  asyncHandler((req, res) => chatController.getConversations(req, res)),
);

// Start new conversation
router.post(
  "/conversations/new",
  authMiddleware,
  asyncHandler((req, res) => chatController.newConversation(req, res)),
);

// Get conversation history
router.get(
  "/conversations/:conversationId",
  authMiddleware,
  asyncHandler((req, res) => chatController.getHistory(req, res)),
);

// Delete conversation
router.delete(
  "/conversations/:conversationId",
  authMiddleware,
  asyncHandler((req, res) => chatController.deleteConversation(req, res)),
);

export default router;
