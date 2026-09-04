'use client';

import { useState, type SyntheticEvent } from 'react';

export function ContactSection() {
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    event.currentTarget.reset();
    setSubmitted(true);
  };

  return (
    <section className="site-screen site-screen--white contact-section">
      <h2 className="contact-section__title">CONTACT</h2>

      <div className="contact-panel">
        <p className="contact-panel__eyebrow">START A PROJECT</p>

        <form className="contact-form" onSubmit={handleSubmit}>
          <div className="contact-form__grid">
            <div className="contact-form__details">
              <label className="contact-field">
                <span>First name</span>
                <input name="firstName" required />
              </label>

              <label className="contact-field">
                <span>Last name</span>
                <input name="lastName" required />
              </label>

              <label className="contact-field">
                <span>Email</span>
                <input name="email" type="email" autoComplete="email" required />
              </label>
            </div>

            <label className="contact-field contact-field--message">
              <span>Tell us about your project</span>
              <textarea name="message" rows={6} required />
            </label>
          </div>

          <div className="contact-form__footer">
            <label className="contact-consent">
              <input name="consent" type="checkbox" required />
              <span>I agree to be contacted about this project.</span>
            </label>

            <button className="contact-submit" type="submit">
              <span>{submitted ? 'MESSAGE SENT' : 'SEND'}</span>
              <svg viewBox="0 0 28 12" fill="none" aria-hidden="true">
                <path d="M0 6h26M20.5.5 26 6l-5.5 5.5" />
              </svg>
            </button>
          </div>

          <p className="contact-form__status" aria-live="polite">
            {submitted ? 'Thank you. We will get back to you shortly.' : ''}
          </p>
        </form>
      </div>

      <footer className="studio-footer">
        <div className="studio-footer__lead">
          <a className="studio-footer__logo" href="#top" aria-label="Orange Horse — back to top">
            Orange Horse <sup>©</sup>
          </a>

          <p className="studio-footer__statement">
            INDEPENDENT DESIGN STUDIO FOR BOLD IDENTITIES,
            <br />
            DIGITAL EXPERIENCES AND IDEAS BUILT TO LAST.
          </p>
        </div>

        <div className="studio-footer__directory">
          <div className="studio-footer__group">
            <p className="studio-footer__label">CONTACT</p>
            <a href="mailto:hello@orangehorse.studio">
              HELLO@ORANGEHORSE.STUDIO
            </a>
          </div>

          <div className="studio-footer__group">
            <p className="studio-footer__label">BASED IN</p>
            <p>
              KYIV, UKRAINE
              <br />
              WORKING WORLDWIDE
            </p>
          </div>

          <div className="studio-footer__group">
            <p className="studio-footer__label">FOLLOW</p>
            <div className="studio-footer__links">
              <a href="https://www.instagram.com/" target="_blank" rel="noreferrer">
                INSTAGRAM
              </a>
              <a href="https://www.behance.net/" target="_blank" rel="noreferrer">
                BEHANCE
              </a>
              <a href="https://www.linkedin.com/" target="_blank" rel="noreferrer">
                LINKEDIN
              </a>
            </div>
          </div>
        </div>

        <div className="studio-footer__bottom">
          <p>© {new Date().getFullYear()} ORANGE HORSE STUDIO</p>
          <p>ALL RIGHTS RESERVED</p>
          <a href="#top">
            BACK TO TOP <span aria-hidden="true">↑</span>
          </a>
        </div>
      </footer>
    </section>
  );
}
