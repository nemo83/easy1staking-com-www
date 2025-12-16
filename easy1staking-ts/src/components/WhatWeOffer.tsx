import React, { useEffect, useState } from "react";
import IncentiveGrid from "./IncentiveGrid";
import InfiniteCarousel from "./InfiniteCarousel";
// import Image1 from "../../public/CardContent1.png";
import Image2 from "../../public/CardContent2.png";
import Image3 from "../../public/CardContent3.png";
import Image4 from "../../public/CardContent4.png";
import Image5 from "../../public/CardContent5.png";
import Image6 from "../../public/CardContent6.png";
import Image7 from "../../public/CardContent7.png";
import Image8 from "../../public/CardContent8.png";
import TagFacesRounded from "../../public/TagFacesRounded.png";
import FlashlightonRounded from "../../public/FlashlightonRounded.png";
import { EASY1STAKING_API } from "@/lib/util/Constants";
import { Distribution } from "@/lib/interfaces/AppTypes";

const WhatWeOffer = () => {

  const [distributions, setDistributions] = useState<Distribution[]>([])

  useEffect(() => {
    fetch(EASY1STAKING_API + '/token_distributions?meme_last=true')
      .then((res) => res.json())
      .then((data: Distribution[]) => {
        console.log('data: ' + JSON.stringify(data))
        setDistributions(data)
        // const groupedData = Array.from({ length: 2 }, () => data.splice(0, 2))
        // setDistributionGroups(groupedData)
      })
  }, [])


  const cards1 = [
    {
      icon: Image7, // replace with your actual icon path
      bgColor: "bg-[#FFCCCC]", // similar to the light red background
      text: "1000 $NIGHT per epoch shared within our pool",
      textColor: "text-black",
    },
    {
      icon: Image2, // replace with your actual icon path
      bgColor: "bg-black", // black background
      text: "25,000 $SNEK shared within our pool",
      textColor: "text-white",
    },
    {
      icon: Image3, // replace with your actual icon path
      bgColor: "bg-[#C4DDFF]", // light blue background
      text: "5,000,000 Low-quality s**t coins per delegate",
      textColor: "text-black",
    },
  ];
  const label1 = {
    image: TagFacesRounded,
    text: "Incentives",
  };
  const cards2 = [
    {
      icon: Image7,
      bgColor: "bg-black", // black background
      text: "Midnight Node Operator",
      textColor: "text-white",
    },
    {
      icon: Image8,
      bgColor: "bg-black", // black background
      text: "World Mobile Earth Node Operator",
      textColor: "text-white",
    },
    {
      icon: Image5, // replace with your actual icon path
      bgColor: "bg-black", // black background
      text: "SundaeSwap Scooper",
      textColor: "text-white",
    },
    {
      icon: Image6, // replace with your actual icon path
      bgColor: "bg-[#C4DDFF]", // light blue background
      text: "Butane Oracle Operator ",
      textColor: "text-black",
    },
    {
      icon: Image4, // replace with your actual icon path
      bgColor: "bg-[#FFCCCC]", // similar to the light red background
      text: "Multiple Opensource projects on Github",
      textColor: "text-black",
    },
  ];
  const label2 = {
    image: FlashlightonRounded,
    text: "Spotlight",
  };
  return (
    <div className="WhatWeOffer ">
      <h1 className="text-[34px] sm:text-[54px] md:text-[64px] py-20 font-semibold text-center">
        What we offer
      </h1>
      <div className="pb-20">
        <IncentiveGrid cards={cards1} label={label1} />
        <div className="mt-20">
          <InfiniteCarousel cards={cards2} label={label2} />
        </div>
      </div>
    </div>
  );
}

export default WhatWeOffer;
