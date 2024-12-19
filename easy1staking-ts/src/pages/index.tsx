import HomeHero from "@/components/HomeHero";
import WhyStakeWithUs from "@/components/WhyStakeWithUs";
import WhatWeOffer from "@/components/WhatWeOffer";
import Distribution from "@/components/Distribution";
import Navbar from "@/components/Navbar";

export default function Home() {
  return (
    <>
      <div className="home-hero min-h-[120vh]">
        <Navbar />
        <HomeHero />
      </div>
      <WhyStakeWithUs />
      <WhatWeOffer />
      <Distribution />
    </>
  );
}
