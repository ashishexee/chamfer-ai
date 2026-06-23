import express from 'express';
import { authMiddleware } from '../middleware/auth';
import { saveChatSession, getChatSessions, getChatSession } from '../services/db';
import type { ChatMessageData } from '../services/db';

export const router = express.Router();

router.post('/save', authMiddleware, async (req, res) => {
  try {
    const walletAddress = (req as any).walletAddress;
    const { sessionId, messages: rawMessages, parameters } = req.body as {
      sessionId?: string;
      messages?: ChatMessageData[];
      parameters?: { name: string; default: number; min?: number; max?: number; step?: number }[];
    };

    if (!rawMessages || rawMessages.length === 0) {
      res.status(400).json({ error: 'Messages are required' });
      return;
    }

    const result = await saveChatSession(walletAddress, rawMessages, parameters as any, sessionId);
    res.json({
      success: !!result,
      sessionId: result?.sessionId || null,
      latestMessageOrder: result?.latestMessageOrder ?? null,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(500).json({ error: msg });
  }
});

router.get('/sessions', authMiddleware, async (req, res) => {
  try {
    const walletAddress = (req as any).walletAddress;
    const sessions = await getChatSessions(walletAddress);
    res.json({ sessions });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(500).json({ error: msg });
  }
});

router.get('/history/:sessionId', authMiddleware, async (req, res) => {
  try {
    const walletAddress = (req as any).walletAddress;
    const result = await getChatSession(req.params.sessionId, walletAddress);
    if (!result) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    // getChatSession already returned camelCase messages
    res.json({
      session: {
        ...result.session,
        messages: result.messages,
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(500).json({ error: msg });
  }
});
