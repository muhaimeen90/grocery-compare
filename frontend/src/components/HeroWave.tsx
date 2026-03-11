'use client';

import { useEffect, useRef } from 'react';

/**
 * FluidCursorBackground
 * ---------------------
 * Renders a WebGL fluid simulation (webgl-fluid-enhanced) as a transparent
 * layer ABOVE the hero content.  White smoke trails follow the cursor, swirl
 * organically, and fade out naturally.
 *
 * Architecture:
 *  - Canvas sits at z-index:20 so smoke renders OVER titles, cards, etc.
 *  - Canvas has pointer-events:none so all UI below stays interactive.
 *  - We listen for mousemove/touchmove on the window and manually call
 *    splatAtLocation() to inject fluid wherever the cursor moves within
 *    the hero bounds.
 *  - The library's own hover tracking is disabled (hover:false) since the
 *    canvas can't receive pointer events.
 */
export default function HeroWave() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let fluid: import('webgl-fluid-enhanced').default | null = null;
    let isDestroyed = false;
    let prevX = 0;
    let prevY = 0;
    let hasPrev = false;

    // Store cleanup functions
    let cleanupFns: (() => void)[] = [];

    // Dynamic import keeps this out of the SSR bundle
    import('webgl-fluid-enhanced').then(({ default: WebGLFluidEnhanced }) => {
      if (isDestroyed) return;

      fluid = new WebGLFluidEnhanced(container);

      // ── Fix: library constructor overrides container styles ─────
      container.style.position = 'absolute';
      container.style.inset = '0';
      container.style.width = '100%';
      container.style.height = '100%';
      container.style.display = 'block';
      container.style.overflow = 'hidden';

      // Canvas must NOT receive pointer events — UI below must stay clickable
      const canvas = container.querySelector('canvas');
      if (canvas) {
        canvas.style.pointerEvents = 'none';
      }

      fluid.setConfig({
        // ── Transparent so green gradient shows through ──────────
        transparent: true,
        backgroundColor: '#000000',

        // ── Faint white smoke ────────────────────────────────────
        colorful: false,
        colorPalette: ['ffffff'],
        brightness: 0.15,

        // ── Fast dissipation so trails fade quickly ──────────────
        densityDissipation: 0.94,
        velocityDissipation: 0.95,

        // ── Small, gentle splats ─────────────────────────────────
        splatRadius: 0.1,
        splatForce: 3000,

        // ── Fluid quality ────────────────────────────────────────
        simResolution: 128,
        dyeResolution: 512,
        pressureIterations: 20,
        curl: 12,

        // ── Visual quality ───────────────────────────────────────
        shading: false,
        bloom: false,
        sunrays: false,

        // ── Disable library pointer capture (canvas is pointer-events:none) ─
        hover: false,
      });

      fluid.start();

      // One subtle ambient splat on load
      fluid.multipleSplats(1);

      // ── Mouse tracking on the whole window ─────────────────────
      const onMouseMove = (e: MouseEvent) => {
        if (!fluid || !container) return;
        const rect = container.getBoundingClientRect();

        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Only inject when cursor is inside the hero
        if (x < 0 || x > rect.width || y < 0 || y > rect.height) {
          hasPrev = false;
          return;
        }

        if (!hasPrev) {
          prevX = e.clientX;
          prevY = e.clientY;
          hasPrev = true;
          return;
        }

        // Pixel delta — velocity proportional to mouse speed
        const dx = e.clientX - prevX;
        const dy = e.clientY - prevY;
        prevX = e.clientX;
        prevY = e.clientY;

        const speed = Math.sqrt(dx * dx + dy * dy);
        if (speed < 2) return;

        // Very gentle force scaling
        const scale = Math.min(speed * 0.15, 4);
        fluid.splatAtLocation(x, y, dx * scale, dy * scale);
      };

      // ── Touch support ───────────────────────────────────────────
      const onTouchMove = (e: TouchEvent) => {
        if (!fluid || !container) return;
        const t = e.touches[0];
        const rect = container.getBoundingClientRect();
        const x = t.clientX - rect.left;
        const y = t.clientY - rect.top;
        if (x < 0 || x > rect.width || y < 0 || y > rect.height) return;

        const dx = t.clientX - prevX;
        const dy = t.clientY - prevY;
        prevX = t.clientX;
        prevY = t.clientY;
        fluid.splatAtLocation(x, y, dx * 8, dy * 8);
      };

      // ── Visibility API — pause when tab hidden ──────────────────
      const onVisibility = () => {
        if (!fluid) return;
        if (document.hidden) fluid.stop();
        else fluid.start();
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('touchmove', onTouchMove, { passive: true });
      document.addEventListener('visibilitychange', onVisibility);

      cleanupFns = [
        () => window.removeEventListener('mousemove', onMouseMove),
        () => window.removeEventListener('touchmove', onTouchMove),
        () => document.removeEventListener('visibilitychange', onVisibility),
      ];
    });

    return () => {
      isDestroyed = true;
      cleanupFns.forEach((fn) => fn());
      if (fluid) {
        fluid.stop();
        fluid = null;
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 w-full h-full"
      style={{ pointerEvents: 'none', zIndex: 20 }}
      aria-hidden="true"
    />
  );
}
