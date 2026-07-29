/**
 * useGameEngine — SSE-based hook that consumes the server's authoritative
 * game state so every device sees the same multiplier at the same time.
 *
 * The server sends phase-change events only (waiting / running / crashed).
 * During the 'running' phase the hook drives a requestAnimationFrame loop to
 * compute the live multiplier locally using the same formula as the server:
 *   m(t) = e^(0.08 * elapsed_seconds)
 * This gives buttery-smooth animation without the server needing to broadcast
 * 20+ messages per second.
 *
 * EventSource reconnects automatically if the connection drops, and the
 * server sends the current snapshot to every new subscriber immediately, so
 * late-joiners and reconnectors are always in sync.
 */

import { useEffect, useRef, useState } from 'react';

export type GamePhase = 'waiting' | 'running' | 'crashed';

// Must match the server's K constant in gameEngine.ts
const K = 0.08;

interface ServerEvent {
  phase: GamePhase;
  roundId: string;
  countdown?: number;  // waiting
  startedAt?: number; // running — ms epoch
  crashPoint?: number; // crashed
  history: number[];
}

export interface GameState {
  phase: GamePhase;
  multiplier: number;
  history: number[];
  countdown: number;
  roundId: string;
}

export function useGameEngine(): GameState {
  const [state, setState] = useState<GameState>({
    phase: 'waiting',
    multiplier: 1.0,
    history: [],
    countdown: 5,
    roundId: '',
  });

  // Refs used inside the rAF loop and fallback timer (avoids stale closures)
  const phaseRef = useRef<GamePhase>('waiting');
  const startedAtRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);
  const lastEventAtRef = useRef<number>(Date.now());
  const fallbackTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopRaf = () => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  };

  const stopFallbackTimer = () => {
    if (fallbackTimerRef.current !== null) {
      clearInterval(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
  };

  const startRaf = () => {
    stopRaf();
    const tick = () => {
      if (phaseRef.current !== 'running') return;
      const elapsed = (Date.now() - startedAtRef.current) / 1000;
      const multiplier = Math.round(Math.pow(Math.E, K * elapsed) * 100) / 100;
      setState((prev) => ({ ...prev, multiplier }));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  // Fallback: if SSE events stop arriving for >3 s, poll /api/game/state
  // every second so the game still runs even when Apache buffers the stream.
  // When a real SSE event arrives it takes over immediately.
  const startFallbackTimer = () => {
    stopFallbackTimer();
    fallbackTimerRef.current = setInterval(async () => {
      const silentMs = Date.now() - lastEventAtRef.current;
      // SSE is healthy — nothing to do
      if (silentMs < 3000) return;

      try {
        const res = await fetch('/api/game/state', { cache: 'no-store' });
        if (!res.ok) return;
        const event = await res.json() as ServerEvent;

        // Stamp the last-received time so we don't spam polls unnecessarily
        lastEventAtRef.current = Date.now();

        if (event.phase === 'waiting') {
          phaseRef.current = 'waiting';
          stopRaf();
          setState({
            phase: 'waiting',
            multiplier: 1.0,
            history: event.history,
            countdown: event.countdown ?? 5,
            roundId: event.roundId,
          });
        } else if (event.phase === 'running') {
          phaseRef.current = 'running';
          startedAtRef.current = event.startedAt!;
          setState((prev) => ({
            ...prev,
            phase: 'running',
            roundId: event.roundId,
            history: event.history,
          }));
          startRaf();
        } else if (event.phase === 'crashed') {
          phaseRef.current = 'crashed';
          stopRaf();
          setState({
            phase: 'crashed',
            multiplier: event.crashPoint!,
            history: event.history,
            countdown: 0,
            roundId: event.roundId,
          });
        }
      } catch {
        // Network error — silently ignore, will retry next interval
      }
    }, 1000);
  };

  useEffect(() => {
    const es = new EventSource('/api/game/stream');
    startFallbackTimer();

    es.onmessage = (e: MessageEvent<string>) => {
      lastEventAtRef.current = Date.now();
      const event = JSON.parse(e.data) as ServerEvent;

      if (event.phase === 'waiting') {
        phaseRef.current = 'waiting';
        stopRaf();
        setState({
          phase: 'waiting',
          multiplier: 1.0,
          history: event.history,
          countdown: event.countdown ?? 5,
          roundId: event.roundId,
        });
      } else if (event.phase === 'running') {
        phaseRef.current = 'running';
        startedAtRef.current = event.startedAt!;
        setState((prev) => ({
          ...prev,
          phase: 'running',
          roundId: event.roundId,
          history: event.history,
        }));
        startRaf();
      } else if (event.phase === 'crashed') {
        phaseRef.current = 'crashed';
        stopRaf();
        setState({
          phase: 'crashed',
          multiplier: event.crashPoint!,
          history: event.history,
          countdown: 0,
          roundId: event.roundId,
        });
      }
    };

    es.onerror = () => {
      // EventSource automatically retries — nothing to do here.
      // The server sends a snapshot on every new connection so the client
      // will re-sync as soon as the connection is restored.
    };

    return () => {
      es.close();
      stopRaf();
      stopFallbackTimer();
    };
  }, []); // single connection per component mount

  return state;
}
