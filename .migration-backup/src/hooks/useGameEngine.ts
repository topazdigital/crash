import { useState, useCallback, useRef, useEffect } from 'react';

export type GamePhase = 'waiting' | 'running' | 'crashed';

interface GameState {
  phase: GamePhase;
  multiplier: number;
  crashPoint: number;
  history: number[];
  countdown: number;
}

function generateCrash(): number {
  const houseEdge = 0.03;
  const r = Math.random();
  const crash = (1 / (1 - r)) * (1 - houseEdge);
  return Math.max(1.0, Math.round(crash * 100) / 100);
}

export function useGameEngine() {
  const [state, setState] = useState<GameState>({
    phase: 'waiting',
    multiplier: 1.0,
    crashPoint: 0,
    history: Array.from({ length: 20 }, () => generateCrash()),
    countdown: 5,
  });

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  const clearIntervals = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    intervalRef.current = null;
    countdownRef.current = null;
  }, []);

  const startRound = useCallback(() => {
    clearIntervals();
    const crashPoint = generateCrash();

    // Countdown phase
    setState(prev => ({ ...prev, phase: 'waiting', countdown: 5, crashPoint: 0, multiplier: 1.0 }));

    let count = 5;
    countdownRef.current = setInterval(() => {
      count--;
      setState(prev => ({ ...prev, countdown: count }));
      if (count <= 0) {
        if (countdownRef.current) clearInterval(countdownRef.current);
        countdownRef.current = null;

        // Start game
        startTimeRef.current = Date.now();
        setState(prev => ({ ...prev, phase: 'running', crashPoint, multiplier: 1.0 }));

        intervalRef.current = setInterval(() => {
          const elapsed = (Date.now() - startTimeRef.current) / 1000;
          const currentMultiplier = Math.pow(Math.E, 0.08 * elapsed);
          const rounded = Math.round(currentMultiplier * 100) / 100;

          if (rounded >= crashPoint) {
            if (intervalRef.current) clearInterval(intervalRef.current);
            intervalRef.current = null;
            setState(prev => ({
              ...prev,
              phase: 'crashed',
              multiplier: crashPoint,
              history: [crashPoint, ...prev.history].slice(0, 20),
            }));

            // Auto restart after 3 seconds
            setTimeout(() => startRound(), 3000);
          } else {
            setState(prev => ({ ...prev, multiplier: rounded }));
          }
        }, 50);
      }
    }, 1000);
  }, [clearIntervals]);

  useEffect(() => {
    startRound();
    return clearIntervals;
  }, []);

  return state;
}
