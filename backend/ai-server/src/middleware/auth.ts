import express from 'express';

const HEX_WALLET_RE = /^0x[a-fA-F0-9]{40}$/;

export function authMiddleware(req: express.Request, res: express.Response, next: express.NextFunction): void {
  const header = req.headers.authorization;

  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing Authorization header. Send: Bearer <wallet_address>' });
    return;
  }

  const walletAddress = header.slice(7).toLowerCase();

  if (!HEX_WALLET_RE.test(walletAddress)) {
    res.status(401).json({ error: 'Invalid wallet address format' });
    return;
  }

  (req as any).walletAddress = walletAddress;
  next();
}

