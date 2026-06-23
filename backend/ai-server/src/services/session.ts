import type { ParameterSchema } from './llm';

export interface ClarificationHistory {
  questions: string[];
  answers: string;
  timestamp: number;
}

export interface SessionMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  images?: string[];
  code?: string;
  parameters?: Record<string, ParameterSchema>;
  error?: string;
  errorCategory?: string;
  inspection?: any;
  clarificationHistory?: ClarificationHistory;
  timestamp: number;
}

export interface Session {
  id: string;
  createdAt: number;
  updatedAt: number;
  messages: SessionMessage[];
  currentCode?: string;
  currentParameters?: Record<string, ParameterSchema>;
  currentDescription?: string;
  currentTags?: string[];
}

const sessions = new Map<string, Session>();
const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function generateId(): string {
  return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createSession(): Session {
  const now = Date.now();
  const session: Session = {
    id: generateId(),
    createdAt: now,
    updatedAt: now,
    messages: [],
  };
  sessions.set(session.id, session);
  return session;
}

export function getSession(id: string): Session | undefined {
  cleanup();
  const session = sessions.get(id);
  if (session) {
    session.updatedAt = Date.now();
  }
  return session;
}

export function updateSession(id: string, update: Partial<Session>): Session | undefined {
  const session = sessions.get(id);
  if (!session) return undefined;
  const updated = { ...session, ...update, updatedAt: Date.now() };
  sessions.set(id, updated);
  return updated;
}

export function addMessageToSession(id: string, message: Omit<SessionMessage, 'timestamp'>): Session | undefined {
  const session = sessions.get(id);
  if (!session) return undefined;
  const msg: SessionMessage = { ...message, timestamp: Date.now() };
  session.messages.push(msg);
  session.updatedAt = Date.now();
  return session;
}

export function deleteSession(id: string): boolean {
  return sessions.delete(id);
}

export function getAllSessionIds(): string[] {
  cleanup();
  return Array.from(sessions.keys());
}

export function cleanup(): void {
  const now = Date.now();
  for (const [id, session] of sessions.entries()) {
    if (now - session.updatedAt > TTL_MS) {
      sessions.delete(id);
    }
  }
}

// Cleanup every hour
setInterval(cleanup, 60 * 60 * 1000);
