"use client";
import Image from "next/image";

export default function IncentiveGrid({ cards, label }) {
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
      </div>

      {/* Cards Grid */}
      <div className="pt-20">
        <div className="px-4 mt-12">
          {/* Mobile: Single column, Tablet: 2 columns, Desktop: 3 columns */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {cards.map((card, index) => (
              <div
                key={index}
                className="w-full max-w-[400px] mx-auto h-[420px] sm:h-[520px] transition-transform duration-300 hover:scale-105"
              >
                <Image
                  src={card.icon}
                  alt="Card icon"
                  className="h-[65%] w-full rounded-t-2xl object-cover"
                />
                <div className="bg-white py-5 px-6 sm:px-10 h-[35%] rounded-b-2xl flex items-center">
                  <h3 className="text-[16px] sm:text-[20px] md:text-[24px] lg:text-[30px] text-[#000000DE] font-semibold leading-tight">
                    {card.text}
                  </h3>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}