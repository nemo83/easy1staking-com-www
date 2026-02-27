"use client";
import { useState, useEffect } from "react";
import { IoIosArrowBack, IoIosArrowForward } from "react-icons/io";
import Image from "next/image";

export default function IncentiveCarousel({ cards, label }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [cardWidth, setCardWidth] = useState(330);

  useEffect(() => {
    const updateCardWidth = () => {
      if (window.innerWidth >= 768) {
        setCardWidth(400); // md breakpoint
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

  const prevCard = () => {
    setCurrentIndex(currentIndex === 0 ? cards.length - 1 : currentIndex - 1);
  };

  const nextCard = () => {
    setCurrentIndex(currentIndex === cards.length - 1 ? 0 : currentIndex + 1);
  };

  const getTransformValue = () => {
    const gap = 24; // space-x-6 = 24px
    return -(currentIndex * (cardWidth + gap));
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
                index === currentIndex ? 'bg-white' : 'bg-white/50'
              }`}
              onClick={() => setCurrentIndex(index)}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      </div>

      {/* Cards Container */}
      <div className="overflow-hidden pt-20">
        <div
          className="flex space-x-6 px-4 mt-12 transition-transform duration-500 ease-in-out"
          style={{
            transform: `translateX(${getTransformValue()}px)`,
          }}
        >
          {cards.map((card, index) => (
            <div
              key={index}
              className="w-[310px] sm:w-[330px] md:w-[400px] h-[420px] sm:h-[520px] flex-shrink-0 transition-transform duration-500 ease-in-out"
            >
              <Image
                src={card.icon}
                alt="Card icon"
                className="h-[65%] w-full rounded-t-2xl object-cover"
              />
              <div className="bg-white py-5 px-10 h-[35%] rounded-b-2xl flex items-center">
                <h3 className="text-[16px] sm:text-[20px] md:text-[30px] text-[#000000DE] font-semibold leading-tight">
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
