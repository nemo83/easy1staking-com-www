"use client";
import { useState } from "react";
import { useSwipeable } from "react-swipeable";
import Image from "next/image";
import styles from "./IncentiveCarousel2.module.css";

export default function IncentiveCarousel2({ cards, label }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const handlers = useSwipeable({
    onSwipedLeft: () => nextCard(),
    onSwipedRight: () => prevCard(),
    onSwiping: () => setIsDragging(true),
    onSwiped: () => setIsDragging(false),
    preventDefaultTouchmoveEvent: true,
    trackMouse: true,
  });

  const prevCard = () => {
    setCurrentIndex(currentIndex === 0 ? cards.length - 1 : currentIndex - 1);
  };

  const nextCard = () => {
    setCurrentIndex(currentIndex === cards.length - 1 ? 0 : currentIndex + 1);
  };

  return (
    <div {...handlers} className={`${styles.carousel} relative select-none`}>
      {/* Cards Container */}
      <div className="overflow-x-scroll scrollbar-hide pt-20 cursor-grab">
        <div
          className={`flex space-x-6 px-4 mt-12 transition-transform duration-500 ease-in-out ${
            isDragging ? "cursor-grabbing" : ""
          }`}
          style={{
            transform: `translateX(-${currentIndex * 115}px)`,
            marginLeft: "50px",
          }}
        >
          {cards.map((card, index) => (
            <div
              key={index}
              className={`w-[315px] sm:w-[464px] md:w-[364px] lg:w-[500px] h-[450px] md:h-[550px] p-10 rounded-3xl relative flex-shrink-0 transition-transform duration-500 ease-in-out`}
              style={{ background: card.bg }}
            >
              <div>
                <h1 className="text-[30px] md:text-[48px] font-semibold">
                  {card.title}
                </h1>
                <p className="w-[80%]">{card.desc}</p>
                <div className="absolute bottom-0">
                  <Image
                    src={card.image}
                    alt="image1"
                    className="rounded-3xl"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
