import React from "react";
import Image1 from "../../public/Frame1.png";
import Image2 from "../../public/Frame2.png";
import Image3 from "../../public/Frame3.png";
import Image4 from "../../public/Frame4.png";

import Image from "next/image";
import { Chip } from "@mui/material";

export const WhyStakeWithUs = () => {
  return (
    <div className="WhyStakeWithUs min-h-[200vh] relative">
      <h1 className="text-[34px] sm:text-[54px] md:text-[64px] font-semibold text-center">
        Why Stake With Us?
      </h1>
      <div className="block md:flex justify-center gap-5 container mx-auto">
        <div className="flex flex-col justify-center items-center mt-20 md:mt-0">
          <div className="w-[315px] sm:w-[464px] md:w-[364px] lg:w-[500px] h-[450px] md:h-[550px] p-10 rounded-3xl relative bg-[#304ffe]">
            <h1 className="text-[30px] md:text-[48px] font-semibold">
              Airdrops
            </h1>
            <p className="w-[80%]">
              Powered by Tosidrop.io, you can earn Extra Rewards every 5 days on
              top of your $ada rewards
            </p>
            <div className="absolute bottom-0 ">
              <Image src={Image1} alt="image1" className="rounded-3xl" />
            </div>
          </div>
          <div className="w-[315px] sm:w-[464px] md:w-[364px] lg:w-[500px] h-[450px] md:h-[550px] p-10 rounded-3xl relative bg-[#82b1ff] mt-20">
            <h1 className="text-[30px] md:text-[48px] font-semibold">
              Low Staking Fee
            </h1>
            <p className="w-[80%]">
              Professionally configured Stakepool, running on Cloud powered by
              100% Renewable Energy
            </p>
            <div className="mt-10">
              <Image src={Image2} alt="image1" />
            </div>
          </div>
        </div>
        <div className="flex flex-col justify-center items-center mt-20 md:mt-40">
          <div className="w-[315px] sm:w-[464px] md:w-[364px] lg:w-[500px] h-[450px] md:h-[550px]  p-10 rounded-3xl relative bg-[#7986cb]">
            <h1 className="text-[30px] md:text-[48px] font-semibold">
              Giveaways <Chip label="Coming Soon" color="primary" />
            </h1>
            <p className="w-[80%]">
              Buy tickets of our on chain raffles and good
              <br /> luck!
            </p>
            <div className="absolute bottom-0 ">
              <Image src={Image3} alt="image1" className="rounded-3xl" />
            </div>
          </div>
          <div className="w-[315px] sm:w-[464px] md:w-[364px] lg:w-[500px] h-[450px] md:h-[550px]  rounded-3xl relative bg-[#1a237e] mt-20">
            <div className="p-10">
              <h1 className="text-[30px] md:text-[48px] font-semibold">
                Raffles <Chip label="Coming Soon" color="secondary" />
              </h1>
              <p className="w-[80%]">
                We run raffles every 5 days. Free to join. <br /> Forever.
              </p>
            </div>
            <div>
              <Image src={Image4} alt="image1" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default WhyStakeWithUs;
