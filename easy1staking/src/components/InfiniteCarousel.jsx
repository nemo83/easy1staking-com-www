"use client";
import { useState, useEffect, useCallback } from "react";
import { IoIosArrowBack, IoIosArrowForward } from "react-icons/io";
import Image from "next/image";

export default function InfiniteCarousel({ cards, label, autoPlay = true, autoPlayInterval = 4000 }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [cardWidth, setCardWidth] = useState(330);
  const [isTransitioning, setIsTransitioning] = useState(true);

  // Create infinite loop by duplicating cards
  const extendedCards = [...cards, ...cards, ...cards];
  const totalCards = cards.length;
  const startIndex = totalCards; // Start from the middle set

  useEffect(() => {
    const updateCardWidth = () => {
      if (window.innerWidth >= 1024) {
        setCardWidth(400); // lg breakpoint
      } else if (window.innerWidth >= 768) {
        setCardWidth(350); // md breakpoint
      } else if (window.innerWidth >= 640) {
        setCardWidth(330); // sm breakpoint
      } else {
        setCardWidth(310); // mobile
      }
    };

    updateCardWidth();
    window.addEventListener('resize', updateCardWidth);
    return () => window.removeEventListener('resize', updateCardWidth);
  }, []);

  // Initialize position to middle set
  useEffect(() => {
    setCurrentIndex(startIndex);
  }, [startIndex]);

  const nextCard = useCallback(() => {
    setCurrentIndex(prev => prev + 1);
  }, []);

  const prevCard = useCallback(() => {
    setCurrentIndex(prev => prev - 1);
  }, []);

  // Handle infinite loop reset
  useEffect(() => {
    if (currentIndex >= totalCards * 2) {
      // Reset to beginning of middle set
      const timer = setTimeout(() => {
        setIsTransitioning(false);
        setCurrentIndex(startIndex);
        setTimeout(() => setIsTransitioning(true), 50);
      }, 500);
      return () => clearTimeout(timer);
    } else if (currentIndex < totalCards) {
      // Reset to end of middle set
      const timer = setTimeout(() => {
        setIsTransitioning(false);
        setCurrentIndex(startIndex + totalCards - 1);
        setTimeout(() => setIsTransitioning(true), 50);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [currentIndex, totalCards, startIndex]);

  // Auto-play functionality
  useEffect(() => {
    if (!autoPlay) return;

    const interval = setInterval(nextCard, autoPlayInterval);
    return () => clearInterval(interval);
  }, [autoPlay, autoPlayInterval, nextCard]);

  const getTransformValue = () => {
    const gap = 24; // space-x-6 = 24px
    return -(currentIndex * (cardWidth + gap));
  };

  const getCurrentCardIndex = () => {
    return ((currentIndex - startIndex) % totalCards + totalCards) % totalCards;
  };

  const goToSlide = (index) => {
    setCurrentIndex(startIndex + index);
  };

  return (
    <div className="relative">
      <div className="container mx-auto relative">
        {/* Label on the top-left */}
        <div className="absolute top-4 left-4 bg-white text-black rounded-full px-4 py-3 flex items-center shadow-md z-10">
          <span className="mr-2">
            <Image src={label.image} alt={label.text} width={24} height={24} />
          </span>
          <span className="font-semibold">{label.text}</span>
        </div>

        {/* Arrows on the top-right */}
        <div className="absolute top-4 right-4 flex space-x-2 bg-white text-lg rounded-2xl p-2 z-10">
          <button
            className="bg-gray-100 text-black p-2 rounded-xl hover:bg-gray-200 transition-colors"
            onClick={prevCard}
            aria-label="Previous card"
          >
            <IoIosArrowBack />
          </button>
          <button
            className="bg-gray-100 text-black p-2 rounded-xl hover:bg-gray-200 transition-colors"
            onClick={nextCard}
            aria-label="Next card"
          >
            <IoIosArrowForward />
          </button>
        </div>

        {/* Dot indicators */}
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-2 z-10">
          {cards.map((_, index) => (
            <button
              key={index}
              className={`w-2 h-2 rounded-full transition-colors ${
                index === getCurrentCardIndex() ? 'bg-white' : 'bg-white/50'
              }`}
              onClick={() => goToSlide(index)}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      </div>

      {/* Cards Container */}
      <div className="overflow-hidden pt-20">
        <div
          className={`flex space-x-6 px-4 mt-12 ${
            isTransitioning ? 'transition-transform duration-500 ease-in-out' : ''
          }`}
          style={{
            transform: `translateX(${getTransformValue()}px)`,
          }}
        >
          {extendedCards.map((card, index) => (
            <div
              key={`${card.text}-${index}`}
              className="w-[310px] sm:w-[330px] md:w-[350px] lg:w-[400px] h-[420px] sm:h-[520px] flex-shrink-0"
            >
              <Image
                src={card.icon}
                alt="Card icon"
                className="h-[65%] w-full rounded-t-2xl object-cover"
              />
              <div className="bg-white py-5 px-6 sm:px-10 h-[35%] rounded-b-2xl flex items-center">
                <h3 className="text-[16px] sm:text-[18px] md:text-[20px] lg:text-[24px] text-[#000000DE] font-semibold leading-tight">
                  {card.text}
                </h3>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}