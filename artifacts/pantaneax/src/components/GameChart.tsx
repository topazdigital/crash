import { useRef, useEffect } from 'react';
import { GamePhase } from '@/hooks/useGameEngine';

interface GameChartProps {
  multiplier: number;
  phase: GamePhase;
  countdown: number;
}

export default function GameChart({ multiplier, phase, countdown }: GameChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointsRef = useRef<{ x: number; y: number }[]>([]);

  useEffect(() => {
    if (phase === 'running') {
      pointsRef.current.push({ x: pointsRef.current.length, y: multiplier });
    } else if (phase === 'waiting') {
      pointsRef.current = [];
    }
  }, [multiplier, phase]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    const w = rect.width;
    const h = rect.height;

    // Clear
    ctx.clearRect(0, 0, w, h);

    // Grid
    ctx.strokeStyle = 'hsla(220, 14%, 18%, 0.5)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 5; i++) {
      const y = h - (h * i) / 5;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    if (phase === 'waiting') {
      ctx.fillStyle = 'hsl(210, 20%, 92%)';
      ctx.font = `bold ${Math.min(48, w * 0.08)}px "JetBrains Mono", monospace`;
      ctx.textAlign = 'center';
      ctx.fillText(`Starting in ${countdown}s`, w / 2, h / 2);
      return;
    }

    const points = pointsRef.current;
    if (points.length < 2) return;

    const maxY = Math.max(multiplier, 2);
    const xScale = w / Math.max(points.length, 50);
    const yScale = (h - 40) / maxY;

    // Draw curve
    ctx.beginPath();
    ctx.moveTo(0, h);
    points.forEach((p, i) => {
      const x = i * xScale;
      const y = h - (p.y * yScale);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });

    // Gradient fill
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    if (phase === 'crashed') {
      gradient.addColorStop(0, 'hsla(0, 72%, 50%, 0.3)');
      gradient.addColorStop(1, 'hsla(0, 72%, 50%, 0)');
      ctx.strokeStyle = 'hsl(0, 72%, 50%)';
    } else {
      gradient.addColorStop(0, 'hsla(25, 95%, 55%, 0.3)');
      gradient.addColorStop(1, 'hsla(25, 95%, 55%, 0)');
      ctx.strokeStyle = 'hsl(25, 95%, 55%)';
    }
    ctx.lineWidth = 3;
    ctx.stroke();

    // Fill area under curve
    const lastPoint = points[points.length - 1];
    ctx.lineTo(lastPoint.x * xScale, h);
    ctx.lineTo(0, h);
    ctx.fillStyle = gradient;
    ctx.fill();

    // Multiplier text
    const fontSize = Math.min(72, w * 0.12);
    ctx.font = `800 ${fontSize}px "JetBrains Mono", monospace`;
    ctx.textAlign = 'center';

    if (phase === 'crashed') {
      ctx.fillStyle = 'hsl(0, 72%, 55%)';
      ctx.fillText(`${multiplier.toFixed(2)}x`, w / 2, h / 2 - 10);
      ctx.font = `600 ${fontSize * 0.35}px "Inter", sans-serif`;
      ctx.fillText('CRASHED!', w / 2, h / 2 + 30);
    } else {
      ctx.fillStyle = 'hsl(25, 95%, 55%)';
      ctx.shadowColor = 'hsla(25, 100%, 50%, 0.5)';
      ctx.shadowBlur = 20;
      ctx.fillText(`${multiplier.toFixed(2)}x`, w / 2, h / 2 + 10);
      ctx.shadowBlur = 0;
    }
  }, [multiplier, phase, countdown]);

  return (
    <div className="relative w-full aspect-[16/9] rounded-xl overflow-hidden bg-game-bg border border-border">
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{ display: 'block' }}
      />
      {phase === 'running' && (
        <div className="absolute top-3 right-3">
          <div className="w-3 h-3 rounded-full bg-success animate-pulse-glow" />
        </div>
      )}
    </div>
  );
}
