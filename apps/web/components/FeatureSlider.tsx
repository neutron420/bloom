"use client";

import { useState } from "react";
import styles from "./FeatureSlider.module.css";

interface Slide {
  id: number;
  image: string;
  title: string;
  description: string;
}

const slides: Slide[] = [
  {
    id: 0,
    image: "/calendar.svg",
    title: "Plan ahead",
    description: "Click New meeting to schedule meetings and send invitations to participants",
  },
  {
    id: 1,
    image: "/meet.svg",
    title: "Join instantly",
    description: "Enter a code or link to join meetings instantly from anywhere",
  },
  {
    id: 2,
    image: "/security.svg",
    title: "Secure meetings",
    description: "Your meetings are protected with enterprise-grade security and encryption",
  },
];

export default function FeatureSlider() {
  const [currentSlide, setCurrentSlide] = useState(1); // Start at 1 because we duplicate slides
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [disableTransition, setDisableTransition] = useState(false);

  // Create infinite loop by duplicating first and last slides
  const infiniteSlides = [slides[slides.length - 1], ...slides, slides[0]];

  const nextSlide = () => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setCurrentSlide((prev) => {
      const next = prev + 1;
      // If we're at the last duplicate slide, smoothly transition then jump to real first
      if (next >= infiniteSlides.length - 1) {
        setTimeout(() => {
          setDisableTransition(true);
          setCurrentSlide(1);
          setTimeout(() => {
            setDisableTransition(false);
            setIsTransitioning(false);
          }, 50);
        }, 500);
        return next;
      }
      setTimeout(() => setIsTransitioning(false), 500);
      return next;
    });
  };

  const prevSlide = () => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setCurrentSlide((prev) => {
      const next = prev - 1;
      // If we're at the first duplicate slide, smoothly transition then jump to real last
      if (next <= 0) {
        setTimeout(() => {
          setDisableTransition(true);
          setCurrentSlide(slides.length);
          setTimeout(() => {
            setDisableTransition(false);
            setIsTransitioning(false);
          }, 50);
        }, 500);
        return next;
      }
      setTimeout(() => setIsTransitioning(false), 500);
      return next;
    });
  };

  const goToSlide = (index: number) => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    // Add 1 because we have a duplicate slide at the beginning
    setCurrentSlide(index + 1);
    setTimeout(() => setIsTransitioning(false), 500);
  };

  return (
    <div className={styles.slider}>
      <div className={styles.sliderContainer}>
        {/* Navigation Arrows */}
        <button
          className={styles.navButton}
          onClick={prevSlide}
          aria-label="Previous slide"
          disabled={isTransitioning}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
          </svg>
        </button>

        {/* Slide Content - Images and Text Together */}
        <div className={styles.slideWrapper}>
          <div
            className={styles.slides}
            style={{ 
              transform: `translateX(-${currentSlide * 100}%)`,
              transition: disableTransition ? 'none' : (isTransitioning ? 'transform 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94)' : 'none')
            }}
          >
            {infiniteSlides.map((slide, index) => (
              <div key={`${slide.id}-${index}`} className={styles.slide}>
                <div className={styles.imageContainer}>
                  <img
                    src={slide.image}
                    alt={slide.title}
                    className={styles.image}
                  />
                </div>
                <div className={styles.content}>
                  <h3 className={styles.title}>{slide.title}</h3>
                  <p className={styles.description}>{slide.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Next Arrow */}
        <button
          className={styles.navButton}
          onClick={nextSlide}
          aria-label="Next slide"
          disabled={isTransitioning}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
          </svg>
        </button>
      </div>

      {/* Dots Indicator */}
      <div className={styles.dots}>
        {slides.map((_, index) => (
          <button
            key={index}
            className={`${styles.dot} ${currentSlide === index + 1 ? styles.dotActive : ""}`}
            onClick={() => goToSlide(index)}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>
    </div>
  );
}

