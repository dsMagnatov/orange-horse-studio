'use client';

import { useEffect } from 'react';

const NUMBER_FALLBACK = 0;

function readNumber(value: string | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NUMBER_FALLBACK;
}

export function HeroScrollDrift() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>('[data-scroll-drift-root]');
    if (!root) return;

    const elements = Array.from(root.querySelectorAll<HTMLElement>('[data-scroll-drift]'));
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let animationFrame = 0;

    const reset = () => {
      elements.forEach((element) => {
        element.style.removeProperty('transform');
      });
    };

    const update = () => {
      animationFrame = 0;

      if (reducedMotion.matches) {
        reset();
        return;
      }

      const progress = Math.min(
        Math.max((window.scrollY - root.offsetTop) / Math.max(root.offsetHeight, 1), 0),
        1,
      );
      const easedProgress = progress * progress * (3 - 2 * progress);

      elements.forEach((element) => {
        const driftY = readNumber(element.dataset.driftY);
        const y = -easedProgress * driftY;
        element.style.transform = `translate3d(0, ${y.toFixed(2)}px, 0)`;
      });
    };

    const scheduleUpdate = () => {
      if (animationFrame !== 0) return;
      animationFrame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', scheduleUpdate, { passive: true });
    window.addEventListener('resize', scheduleUpdate, { passive: true });
    reducedMotion.addEventListener('change', scheduleUpdate);

    return () => {
      cancelAnimationFrame(animationFrame);
      window.removeEventListener('scroll', scheduleUpdate);
      window.removeEventListener('resize', scheduleUpdate);
      reducedMotion.removeEventListener('change', scheduleUpdate);
      reset();
    };
  }, []);

  return null;
}
