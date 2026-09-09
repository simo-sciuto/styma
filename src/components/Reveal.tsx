'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Fade-e-salita quando l'elemento entra nello schermo, non al caricamento
 * — per le sezioni sotto l'hero, che al caricamento non si vedono comunque.
 * Chi ha chiesto meno movimento al sistema operativo parte gia' visibile
 * (calcolato nello stato iniziale, non con un setState nell'effetto), senza
 * aspettare uno scroll che non muovera' nulla.
 *
 * `as` sceglie il tag reale: un <li> dentro un <ol> deve restare un <li>,
 * non un <div> che lo avvolge — l'HTML dell'elenco resterebbe scorretto.
 */
export function Reveal({
  children,
  className = '',
  delay = 0,
  as: Tag = 'div',
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  as?: 'div' | 'li';
}) {
  const ref = useRef<HTMLDivElement & HTMLLIElement>(null);
  const [visible, setVisible] = useState(prefersReducedMotion);

  useEffect(() => {
    if (visible) return;
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [visible]);

  return (
    <Tag
      ref={ref}
      className={`transition-all duration-700 ease-out ${
        visible ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0'
      } ${className}`}
      style={{ transitionDelay: `${delay}ms`, transitionTimingFunction: 'var(--ease-smooth)' }}
    >
      {children}
    </Tag>
  );
}
