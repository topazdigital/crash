/**
 * Server-authoritative crash game engine.
 *
 * A single instance of this class runs on the server and drives the game loop
 * for all connected players. Clients receive phase-change events via SSE and
 * compute the live multiplier locally (same formula) for smooth animation.
 *
 * Phases:  waiting (5-second countdown) → running → crashed → waiting …
 *
 * Events sent to clients (never expose crashPoint during 'running'):
 *   waiting  { phase, roundId, countdown, history }
 *   running  { phase, roundId, startedAt, history }
 *   crashed  { phase, roundId, crashPoint, history }
 */

import { randomUUID } from 'node:crypto';
import type { Response } from 'express';
import { logger } from './logger';

export type Phase = 'waiting' | 'running' | 'crashed';

export interface GameEvent {
  phase: Phase;
  roundId: string;
  countdown?: number;   // only in 'waiting'
  startedAt?: number;  // ms since epoch, only in 'running'
  crashPoint?: number; // only in 'crashed'
  history: number[];
}

// Multiplier formula (must match client): m(t) = e^(K * t_seconds)
const K = 0.08;
const COUNTDOWN_SECS = 5;
const CRASHED_DISPLAY_MS = 3_000;

function generateCrashPoint(): number {
  const houseEdge = 0.03;
  const r = Math.random();
  const crash = (1 / (1 - r)) * (1 - houseEdge);
  return Math.max(1.01, Math.round(crash * 100) / 100);
}

/** Milliseconds from round start until multiplier reaches crashPoint */
function crashDurationMs(crashPoint: number): number {
  return (Math.log(crashPoint) / K) * 1_000;
}

class ServerGameEngine {
  private phase: Phase = 'waiting';
  private roundId = randomUUID();
  private crashPoint = 2.0;
  private startedAt = 0;
  private countdown = COUNTDOWN_SECS;
  private history: number[] = [];
  private clients = new Map<string, Response>();
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    // Short delay so the HTTP server is listening before the first broadcast
    setTimeout(() => this.beginWaiting(), 500);
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /** Register an SSE client. Returns an unsubscribe function. */
  subscribe(id: string, res: Response): () => void {
    this.clients.set(id, res);
    // Send the current state immediately so new joiners are in sync
    this.sendTo(res, this.snapshot());
    return () => this.clients.delete(id);
  }

  getPhase(): Phase { return this.phase; }
  getRoundId(): string { return this.roundId; }

  /** Return the current game snapshot for REST polling clients. */
  getSnapshot(): GameEvent { return this.snapshot(); }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private snapshot(): GameEvent {
    switch (this.phase) {
      case 'waiting':
        return {
          phase: 'waiting',
          roundId: this.roundId,
          countdown: this.countdown,
          history: this.history,
        };
      case 'running':
        return {
          phase: 'running',
          roundId: this.roundId,
          startedAt: this.startedAt,
          history: this.history,
          // crashPoint intentionally omitted — clients must not know in advance
        };
      case 'crashed':
        return {
          phase: 'crashed',
          roundId: this.roundId,
          crashPoint: this.crashPoint,
          history: this.history,
        };
    }
  }

  private broadcast(event: GameEvent) {
    const dead: string[] = [];
    for (const [id, res] of this.clients) {
      if (!this.sendTo(res, event)) dead.push(id);
    }
    for (const id of dead) this.clients.delete(id);
  }

  private sendTo(res: Response, event: GameEvent): boolean {
    try {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
      return true;
    } catch {
      return false;
    }
  }

  private clearTimer() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  // ── Game loop ─────────────────────────────────────────────────────────────

  private beginWaiting() {
    this.clearTimer();
    this.phase = 'waiting';
    this.roundId = randomUUID();
    this.crashPoint = generateCrashPoint();
    this.countdown = COUNTDOWN_SECS;

    const tick = () => {
      this.broadcast(this.snapshot());
      if (this.countdown <= 0) {
        // "0s" displayed — now launch
        this.timer = setTimeout(() => this.beginRunning(), 1_000);
        return;
      }
      this.countdown--;
      this.timer = setTimeout(tick, 1_000);
    };
    tick();
  }

  private beginRunning() {
    this.clearTimer();
    this.phase = 'running';
    this.startedAt = Date.now();
    this.broadcast(this.snapshot()); // crashPoint NOT included

    const durationMs = crashDurationMs(this.crashPoint);
    logger.debug({ roundId: this.roundId, crashPoint: this.crashPoint, durationMs }, 'Round running');
    this.timer = setTimeout(() => this.beginCrashed(), durationMs);
  }

  private beginCrashed() {
    this.clearTimer();
    this.phase = 'crashed';
    this.history = [this.crashPoint, ...this.history].slice(0, 20);
    this.broadcast(this.snapshot());

    logger.debug({ roundId: this.roundId, crashPoint: this.crashPoint }, 'Round crashed');
    this.timer = setTimeout(() => this.beginWaiting(), CRASHED_DISPLAY_MS);
  }
}

// Module-level singleton — one game loop for all connected clients
export const gameEngine = new ServerGameEngine();
