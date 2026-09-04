import { AsciiHorseBackground } from '@/components/ascii-horse-background';
import { AnimatedHeroTitle } from '@/components/animated-hero-title';
import { ContactSection } from '@/components/contact-section';
import { HeroScrollDrift } from '@/components/hero-scroll-drift';
import { StickyGallery } from '@/components/sticky-gallery';

export default function Home() {
  return (
    <main className="site-stage">
      <AsciiHorseBackground />

      <section
        id="top"
        className="site-screen site-screen--horse"
        data-scroll-drift-root
      >
        <HeroScrollDrift />

        <div className="hero-logo" aria-label="Orange Horse copyright">
          <span
            className="hero-logo__mark"
            data-scroll-drift
            data-drift-y="36"
          >
            Orange Horse <sup>©</sup>
          </span>
        </div>

        <p
          className="hero-description"
          data-scroll-drift
          data-drift-y="54"
        >
          <span className="hero-description__bracket" aria-hidden="true">
            [
          </span>
          <span className="hero-description__copy">
            <span>WE SHAPE BOLD IDENTITIES AND DIGITAL</span>
            <span>EXPERIENCES FOR BRANDS THAT VALUE</span>
            <span>CLEAR THINKING, TIMELESS CRAFT,</span>
            <span>AND IDEAS BUILT TO LAST.</span>
          </span>
          <span
            className="hero-description__bracket hero-description__bracket--end"
            aria-hidden="true"
          >
            ]
          </span>
        </p>

        <AnimatedHeroTitle />

        <div className="hero-scroll-cue" aria-hidden="true">
          <svg
            className="hero-scroll-cue__arrow"
            viewBox="0 0 16 40"
            fill="none"
          >
            <path d="M8 1V37M2.5 31.5 8 37l5.5-5.5" />
          </svg>
        </div>
      </section>

      <StickyGallery />

      <ContactSection />
    </main>
  );
}
