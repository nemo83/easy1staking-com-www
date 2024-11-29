import React from "react";
import Coin from "./../assets/Coin.png";
import Image from "next/image";

function HomeHero() {
  return (
    <div className="mt-20 flex flex-col-reverse md:flex-row justify-center items-center md:justify-between  container mx-auto">
      <div className=" p-5 md:px-0">
        <h1 className="text-[30px] sm:text-[40px] md:text-[60px] lg:text-[80px] font-semibold">
          Simple, Secure <br />& Rewarding
        </h1>
        <p className="text-[#DDDDDD] w-[100%] md:w-[60%]">
          Since launching in 2020, EASY1 has minted over 2k blocks, staked over
          4 million ADA and attracted a community of more than 470 delegators.
        </p>
        <button className="font-semibold px-5 p-3 mt-10 rounded-full bg-[#304FFE]">
          Stake with EASY1
        </button>
      </div>
      <div className=" p-5 md:px-0">
        <Image src={Coin} />
      </div>
    </div>
  );
}

export default HomeHero;
