'use client';

import { useEffect, useState } from 'react';

type HeroPhrase = readonly [string, string, string, string, string];

const PHRASES = [
  ['WHERE', 'BOLD VISION', 'MEETS', 'TIMELESS', 'CRAFT'],
  ['WHERE', 'FRESH IDEAS', 'BUILD', 'LASTING', 'BRANDS'],
  ['WHERE', 'BRAVE MINDS', 'SHAPE', 'DIGITAL', 'WORLDS'],
] as const satisfies readonly HeroPhrase[];

const SCRAMBLE_CHARACTERS = 'HORSE+-*#=';
const CYCLE_DURATION = 5000;
const SCRAMBLE_DURATION = 3000;
const CHARACTER_STEP_DURATION = 64;

function scrambleWord(
  source: string,
  target: string,
  wordIndex: number,
  progress: number,
) {
  const length = Math.max(source.length, target.length);
  let result = '';

  for (let characterIndex = 0; characterIndex < length; characterIndex += 1) {
    const sourceCharacter = source[characterIndex] ?? '';
    const targetCharacter = target[characterIndex] ?? '';

    if (targetCharacter === ' ') {
      result += ' ';
      continue;
    }

    const order = ((characterIndex * 7 + wordIndex * 11) % 17) / 16;
    const settlesAt = 0.18 + order * 0.66;

    if (progress >= settlesAt) {
      result += targetCharacter;
    } else if (progress < 0.08 && sourceCharacter) {
      result += sourceCharacter;
    } else {
      const randomIndex = Math.floor(Math.random() * SCRAMBLE_CHARACTERS.length);
      result += SCRAMBLE_CHARACTERS[randomIndex];
    }
  }

  return result.trimEnd();
}

export function AnimatedHeroTitle() {
  const [words, setWords] = useState<string[]>([...PHRASES[0]]);

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let sourceWords: string[] = [...PHRASES[0]];
    let phraseIndex = 0;
    let animationFrame = 0;
    let interval = 0;

    const stop = () => {
      cancelAnimationFrame(animationFrame);
      window.clearInterval(interval);
      animationFrame = 0;
      interval = 0;
    };

    const transitionTo = (target: HeroPhrase) => {
      cancelAnimationFrame(animationFrame);
      const startedAt = performance.now();
      let lastCharacterStep = startedAt - CHARACTER_STEP_DURATION;

      const animate = (now: number) => {
        const progress = Math.min((now - startedAt) / SCRAMBLE_DURATION, 1);
        const shouldUpdateCharacters =
          now - lastCharacterStep >= CHARACTER_STEP_DURATION || progress >= 1;

        if (shouldUpdateCharacters) {
          lastCharacterStep = now;
          setWords(
            target.map((word, index) =>
              scrambleWord(sourceWords[index] ?? '', word, index, progress),
            ),
          );
        }

        if (progress < 1) {
          animationFrame = requestAnimationFrame(animate);
        } else {
          sourceWords = [...target];
          setWords([...target]);
          animationFrame = 0;
        }
      };

      animationFrame = requestAnimationFrame(animate);
    };

    const configure = () => {
      stop();
      phraseIndex = 0;
      sourceWords = [...PHRASES[0]];
      setWords([...PHRASES[0]]);

      if (reducedMotion.matches) return;

      interval = window.setInterval(() => {
        if (document.hidden) return;
        phraseIndex = (phraseIndex + 1) % PHRASES.length;
        transitionTo(PHRASES[phraseIndex]);
      }, CYCLE_DURATION);
    };

    configure();
    reducedMotion.addEventListener('change', configure);

    return () => {
      reducedMotion.removeEventListener('change', configure);
      stop();
    };
  }, []);

  return (
    <h1
      className="hero-title"
      data-scroll-drift
      data-drift-y="76"
      aria-label="Where bold vision meets timeless craft"
    >
      <span className="hero-title__visual" aria-hidden="true">
        <span className="hero-title__line">{words[0]}</span>
        <span className="hero-title__line hero-title__line--vision">{words[1]}</span>
        <span className="hero-title__line hero-title__line--split">
          <span>{words[2]}</span>
          <span className="hero-title__timeless">{words[3]}</span>
        </span>
        <span className="hero-title__line">{words[4]}</span>
      </span>
    </h1>
  );
}
