"use client";
import { useState } from "react";
import { IoIosArrowBack, IoIosArrowForward } from "react-icons/io";
import Image from "next/image";

export default function IncentiveCarousel({ cards, label }) {
  const [currentIndex, setCurrentIndex] = useState(2);

  const prevCard = () => {
    setCurrentIndex(currentIndex === 0 ? cards.length - 1 : currentIndex - 1);
  };

  const nextCard = () => {
    setCurrentIndex(currentIndex === cards.length - 1 ? 0 : currentIndex + 1);
  };

  return (
    <div className="relative">
      <div className="container mx-auto relative">
        {/* Label on the top-left */}
        <div className="absolute top-4 left-4 bg-white text-black rounded-full px-4 py-3 flex items-center shadow-md">
          <span className="mr-2">
            <Image src={label.image} />
          </span>
          <span className="font-semibold">{label.text}</span>
        </div>

        {/* Arrows on the top-right */}
        <div className="absolute top-4 right-4 flex space-x-2 bg-white text-lg rounded-2xl p-2">
          <button
            className="bg-gray-100 text-black p-2 rounded-xl "
            onClick={prevCard}
          >
            <IoIosArrowBack />
          </button>
          <button
            className="bg-gray-100 text-black p-2 rounded-xl "
            onClick={nextCard}
          >
            <IoIosArrowForward />
          </button>
        </div>
      </div>

      {/* Cards Container */}
      <div className="overflow-x-scroll md:overflow-x-hidden scrollbar-hide pt-20">
        <div
          className="flex space-x-6 px-4 mt-12 transition-transform duration-500 ease-in-out"
          style={{
            transform: ` translateX(${currentIndex * 100}px)`, // Adjusted to slide cards correctly
            marginLeft: "0px", // Move the card container inward from the left
          }}
        >
          {cards.map((card, index) => (
            <div
              key={index}
              className={`w-[310px] sm:w-[330px] md:w-[400px]  h-[420px] sm:h-[520px] flex-shrink-0
             transition-transform duration-500 ease-in-out`}
            >
              <Image
                src={card.icon}
                alt="Icon"
                className=" h-[65%] w-full rounded-t-2xl"
              />
              <div className="bg-white py-5 px-10 h-[35%] rounded-b-2xl">
                <h3 className="text-[16px] sm:text-[20px] md:text-[30px] text-[#000000DE] font-semibold">
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
