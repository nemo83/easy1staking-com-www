import React from "react";
import Navbar from "../components/Navbar";
import IncentiveCarousel2 from "../components/IncentiveSlider2";
import Image1 from "./../assets/Frame1.png";
import Image2 from "./../assets/Frame2.png";
import Image3 from "./../assets/Frame3.png";
import Image4 from "./../assets/Frame4.png";
import Footer from "../components/Footer";
function page() {
  const cards = [
    {
      bg: "#304ffe", // similar to the light red background
      title: "Airdrops",
      desc: ` Powered by Tosidrop.io, you can earn Extra Rewards every 5 days on
              top of your $ada rewards`,
      image: Image1,
    },
    {
      bg: "#7986cb", // similar to the light red background
      title: "Giveaways",
      desc: `  Buy tickets of our on chain raffles and good
               luck!`,
      image: Image3,
    },
    {
      bg: "#82b1ff", // similar to the light red background
      title: "Low Staking Fee",
      desc: `  Professionally configured Stakepool, running on Cloud powered by
              100% Renewable Energy`,
      image: Image2,
    },
  ];
  return (
    <div className="wallet-not-connected min-h-[100vh]">
      <Navbar wallet={true} />
      <div className="h-full flex flex-col justify-center items-center">
        <h1 className="text-[34px] sm:text-[54px] md:text-[64px] py-16 font-semibold text-center">
          Start staking with Easy1
        </h1>
        <button className="font-semibold bg-[#304FFE] p-4 px-6 rounded-full">
          Stake with EASY1
        </button>
      </div>
      <h1 className="text-[34px] sm:text-[54px] md:text-[64px] py-16 font-semibold text-center">
        You’re missing out on
      </h1>
      <IncentiveCarousel2 cards={cards} />
      <div className="flex justify-center">
        <button className="font-semibold bg-[#304FFE] p-4 px-6 rounded-full text-center mt-20">
          Stake with EASY1
        </button>
      </div>
      <Footer />
    </div>
  );
}

export default page;
