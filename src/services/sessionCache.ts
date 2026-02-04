const SESSION_TTL_MS = 5 * 60 * 1000; // 5 minutes

export interface CachedSession<T> {
  session: T;
  lastActivity: number;
  timer: ReturnType<typeof setTimeout>;
}

export class SessionCache<T> {
  private sessions = new Map<string, CachedSession<T>>();
  private onExpire: (sessionId: string, session: T) => void;

  constructor(onExpire: (sessionId: string, session: T) => void) {
    this.onExpire = onExpire;
  }

  get(sessionId: string): T | undefined {
    const cached = this.sessions.get(sessionId);
    if (cached) {
      this.touch(sessionId);
      return cached.session;
    }
    return undefined;
  }

  set(sessionId: string, session: T): void {
    const existing = this.sessions.get(sessionId);
    if (existing) {
      clearTimeout(existing.timer);
    }

    const timer = setTimeout(() => {
      this.expire(sessionId);
    }, SESSION_TTL_MS);

    this.sessions.set(sessionId, {
      session,
      lastActivity: Date.now(),
      timer,
    });
  }

  touch(sessionId: string): void {
    const cached = this.sessions.get(sessionId);
    if (cached) {
      clearTimeout(cached.timer);
      cached.lastActivity = Date.now();
      cached.timer = setTimeout(() => {
        this.expire(sessionId);
      }, SESSION_TTL_MS);
    }
  }

  private expire(sessionId: string): void {
    const cached = this.sessions.get(sessionId);
    if (cached) {
      this.onExpire(sessionId, cached.session);
      this.sessions.delete(sessionId);
    }
  }

  delete(sessionId: string): T | undefined {
    const cached = this.sessions.get(sessionId);
    if (cached) {
      clearTimeout(cached.timer);
      this.sessions.delete(sessionId);
      return cached.session;
    }
    return undefined;
  }

  clear(): void {
    for (const [sessionId, cached] of this.sessions) {
      clearTimeout(cached.timer);
      this.onExpire(sessionId, cached.session);
    }
    this.sessions.clear();
  }

  get size(): number {
    return this.sessions.size;
  }

  values(): T[] {
    return Array.from(this.sessions.values()).map((cached) => cached.session);
  }
}
