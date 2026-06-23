import React from "react";
import Jackpot from "../assets/Jackpot.png";
import Participants from "../assets/Participants.png";
import TotalRaffles from "../assets/TotalRaffles.png";
import TotalWon from "../assets/TotalWon.png";
import Image from "next/image";

const stats = [
  { id: 1, icon: Jackpot, label: "Jackpot", value: "0 ADA" },
  { id: 2, icon: Participants, label: "Participants", value: "6646" },
  { id: 3, icon: TotalRaffles, label: "Total Raffles", value: "375" },
  { id: 4, icon: TotalWon, label: "Total Won", value: "1830 ADA" },
];

function RafflesHero() {
  return (
    <div>
      <h1 className="text-[34px] sm:text-[54px] md:text-[64px] pt-20 mb-10 font-semibold text-center">
        Raffles
      </h1>
      <div className="flex flex-wrap justify-center gap-4 p-4">
        {stats.map((stat) => (
          <div
            key={stat.id}
            className="border  border-[#999999] w-[200px] rounded-3xl shadow-md p-6 flex flex-col justify-between h-52"
          >
            <div className="text-blue-500 text-4xl ">
              <Image src={stat.icon} alt="icon" className="h-6 object-contain" />
              <h3 className="text-[16px] text-white  mt-5">
                {stat.label}
              </h3>
            </div>
            <p className="text-2xl font-semibold text-white">{stat.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default RafflesHero;
