'use client';

import { useEffect, useRef } from 'react';

const SPACING = 30;
const BASE_RADIUS = 1.5;
const MAX_RADIUS = 5.5;
const INFLUENCE_RADIUS = 140;
const BASE_ALPHA = 0.13;
// green-500 (#22c55e)
const DOT_R = 34;
const DOT_G = 197;
const DOT_B = 94;

interface Props {
  className?: string;
}

export default function DotGrid({ className = '' }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef<{ x: number; y: number } | null>(null);
  const animRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };

    resize();

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const mouse = mouseRef.current;
      const t = performance.now() / 1000;
      const cols = Math.ceil(canvas.width / SPACING) + 1;
      const rows = Math.ceil(canvas.height / SPACING) + 1;

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = c * SPACING;
          const y = r * SPACING;

          // Idle wave — subtle rolling pulse across the grid
          const wave = (Math.sin(t * 0.9 + c * 0.25 + r * 0.25) + 1) / 2;
          let radius = BASE_RADIUS;
          let alpha = BASE_ALPHA + wave * 0.06;

          if (mouse) {
            const dx = x - mouse.x;
            const dy = y - mouse.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < INFLUENCE_RADIUS) {
              // Smooth-step easing for soft falloff
              const t2 = 1 - dist / INFLUENCE_RADIUS;
              const eased = t2 * t2 * (3 - 2 * t2);
              radius = BASE_RADIUS + (MAX_RADIUS - BASE_RADIUS) * eased;
              alpha = BASE_ALPHA + (0.9 - BASE_ALPHA) * eased;
            }
          }

          ctx.beginPath();
          ctx.arc(x, y, Math.max(0.1, radius), 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${DOT_R},${DOT_G},${DOT_B},${alpha.toFixed(3)})`;
          ctx.fill();
        }
      }

      animRef.current = requestAnimationFrame(draw);
    };

    draw();

    const ro = new ResizeObserver(resize);
    const parent = canvas.parentElement;
    if (parent) ro.observe(parent);

    const onMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      if (x >= 0 && x <= rect.width && y >= 0 && y <= rect.height) {
        mouseRef.current = { x, y };
      } else {
        mouseRef.current = null;
      }
    };

    const onMouseLeave = () => {
      mouseRef.current = null;
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseleave', onMouseLeave);

    return () => {
      cancelAnimationFrame(animRef.current);
      ro.disconnect();
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseleave', onMouseLeave);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 w-full h-full pointer-events-none ${className}`}
    />
  );
}
