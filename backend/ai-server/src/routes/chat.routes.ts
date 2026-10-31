import express from 'express';
import { authMiddleware } from '../middleware/auth';
import {
  saveChatSession,
  getChatSessions,
  getChatSession,
  renameChatSession,
  listSessionIterations,
} from '../services/db';
import { toIteration } from '../lib/serialize';
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

    if (!result) {
      // Never answer 200 for a rejected save: the client would skip the 0G
      // upload thinking the transcript was persisted.
      res.status(404).json({ error: 'Session not found or not owned by this wallet' });
      return;
    }

    res.json({
      success: true,
      sessionId: result.sessionId,
      latestMessageOrder: result.latestMessageOrder,
      latestMessageId: result.latestMessageId,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('stale_transcript')) {
      res.status(409).json({
        error: 'This chat has newer messages in another tab. Reload it before saving.',
      });
      return;
    }
    if (msg.includes('session_not_found')) {
      res.status(404).json({ error: 'Session not found or not owned by this wallet' });
      return;
    }
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

router.patch('/sessions/:sessionId', authMiddleware, async (req, res) => {
  try {
    const walletAddress = (req as any).walletAddress;
    const { title } = req.body as { title?: unknown };

    if (typeof title !== 'string' || !title.trim()) {
      res.status(400).json({ error: 'A non-empty title is required' });
      return;
    }

    const session = await renameChatSession(req.params.sessionId, walletAddress, title);
    if (!session) {
      res.status(404).json({ error: 'Session not found or not owned by this wallet' });
      return;
    }

    res.json({ success: true, session });
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

    // Return the full iteration history in the same round-trip so a reload can
    // attach per-message hashes without a second waterfall request.
    const iterations = await listSessionIterations(req.params.sessionId, walletAddress);

    res.json({
      session: {
        ...result.session,
        messages: result.messages,
        iterations: iterations.map(toIteration),
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(500).json({ error: msg });
  }
});
