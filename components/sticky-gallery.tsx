'use client';

import Image from 'next/image';
import {
  Fragment,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react';

const GALLERY_ITEMS = [
  {
    src: '/gallery/merigrove.jpg',
    alt: 'Merigrove branding and web design project',
    name: 'Merigrove Identity',
    aspectRatio: 736 / 1383,
    viewportHeight: 76,
  },
  {
    src: '/gallery/anima.jpg',
    alt: 'Anima nature-inspired venture studio website',
    name: 'Anima Ventures',
    aspectRatio: 1200 / 1875,
    viewportHeight: 80,
  },
  {
    src: '/gallery/pricing-plan.jpg',
    alt: 'Creative studio pricing page design',
    name: 'Prism Commerce',
    aspectRatio: 736 / 1283,
    viewportHeight: 70,
  },
  {
    src: '/gallery/terraform.jpg',
    alt: 'TerraForma sustainable architecture website',
    name: 'TerraForma Living',
    aspectRatio: 736 / 1472,
    viewportHeight: 78,
  },
] as const;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export function StickyGallery() {
  const sectionRef = useRef<HTMLElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [paginationVisible, setPaginationVisible] = useState(false);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const cards = Array.from(
      section.querySelectorAll<HTMLElement>('[data-gallery-card]'),
    );
    const anchors = Array.from(
      section.querySelectorAll<HTMLElement>('[data-gallery-anchor]'),
    );
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frameId = 0;

    const update = () => {
      frameId = 0;
      const sectionBounds = section.getBoundingClientRect();
      const sectionTop = sectionBounds.top + window.scrollY;
      const stickyTop =
        window.innerHeight * (window.innerWidth <= 760 ? 0.12 : 0.04);
      let nextActiveIndex = 0;

      const nextPaginationVisible =
        sectionBounds.top <= 1 && sectionBounds.bottom > window.innerHeight + 1;
      setPaginationVisible((currentValue) =>
        currentValue === nextPaginationVisible ? currentValue : nextPaginationVisible,
      );

      anchors.forEach((anchor, index) => {
        const anchorTop = anchor.getBoundingClientRect().top + window.scrollY;
        const cardStart = Math.max(sectionTop, anchorTop) - stickyTop;

        if (window.scrollY >= cardStart - 1) {
          nextActiveIndex = index;
        }
      });

      if (reducedMotion.matches) {
        cards.forEach((card) => {
          card.style.removeProperty('--gallery-scale');
          card.style.removeProperty('--gallery-rotate');
        });
        setActiveIndex((currentIndex) =>
          currentIndex === nextActiveIndex ? currentIndex : nextActiveIndex,
        );
        return;
      }

      const animationDistance = 10000;

      cards.forEach((card, index) => {
        const anchor = anchors[index];
        if (!anchor) return;

        const anchorTop = anchor.getBoundingClientRect().top + window.scrollY;
        const cardStart = Math.max(sectionTop, anchorTop) - stickyTop;
        const progress = clamp01((window.scrollY - cardStart) / animationDistance);
        const rotation = progress * 100;

        card.style.setProperty('--gallery-scale', String(1 - progress));
        card.style.setProperty('--gallery-rotate', `${rotation}deg`);
      });

      setActiveIndex((currentIndex) =>
        currentIndex === nextActiveIndex ? currentIndex : nextActiveIndex,
      );
    };

    const scheduleUpdate = () => {
      if (frameId) return;
      frameId = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', scheduleUpdate, { passive: true });
    window.addEventListener('resize', scheduleUpdate, { passive: true });
    reducedMotion.addEventListener('change', scheduleUpdate);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener('scroll', scheduleUpdate);
      window.removeEventListener('resize', scheduleUpdate);
      reducedMotion.removeEventListener('change', scheduleUpdate);
    };
  }, []);

  const scrollToProject = (index: number) => {
    const section = sectionRef.current;
    const anchor = section?.querySelectorAll<HTMLElement>('[data-gallery-anchor]')[
      index
    ];
    if (!anchor) return;

    const targetY =
      anchor.getBoundingClientRect().top +
      window.scrollY -
      window.innerHeight * (window.innerWidth <= 760 ? 0.12 : 0.04);
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    window.scrollTo({
      top: targetY,
      behavior: reducedMotion ? 'auto' : 'smooth',
    });
  };

  return (
    <section
      ref={sectionRef}
      className="site-screen site-screen--orange sticky-gallery"
      aria-label="Orange Horse selected work gallery"
    >
      <div
        className="sticky-gallery__pagination-rail"
        data-visible={paginationVisible ? 'true' : 'false'}
      >
        <nav className="sticky-gallery__pagination" aria-label="Gallery projects">
          <ol>
            {GALLERY_ITEMS.map((item, index) => (
              <li key={item.name}>
                <button
                  type="button"
                  className="sticky-gallery__page"
                  aria-current={activeIndex === index ? 'step' : undefined}
                  onClick={() => scrollToProject(index)}
                >
                  <span className="sticky-gallery__page-line" aria-hidden="true" />
                  <span className="sticky-gallery__page-label">
                    <span className="sticky-gallery__page-number">
                      {String(index + 1).padStart(2, '0')}
                    </span>{' '}
                    {item.name}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </nav>
      </div>

      <div className="sticky-gallery__stack">
        {GALLERY_ITEMS.map((item, index) => (
          <Fragment key={item.src}>
            <span
              className="sticky-gallery__anchor"
              data-gallery-anchor
              aria-hidden="true"
            />
            <article
              className="sticky-gallery__card"
              data-gallery-card
              style={
                {
                  zIndex: index + 1,
                  '--gallery-aspect-ratio': item.aspectRatio,
                  '--gallery-width': `${item.viewportHeight * item.aspectRatio * 1.3}svh`,
                } as CSSProperties
              }
            >
              <div className="sticky-gallery__visual">
                <Image
                  className="sticky-gallery__image"
                  src={item.src}
                  alt={item.alt}
                  fill
                  sizes="(max-width: 760px) calc(100vw - 32px), 720px"
                />
              </div>
            </article>
          </Fragment>
        ))}
      </div>
    </section>
  );
}
