import Navbar from "./components/Navbar";
import HomeHero from "./components/HomeHero";
import WhyStakeWithUs from "./components/WhyStakeWithUs";
import WhatWeOffer from "./components/WhatWeOffer";
import Distribution from "./components/Distribution";
import WalletProvider from "./components/WalletProvider";
export default function Home() {

  return (
    <WalletProvider>
      <div className="home-bg">
        <div className="home-hero min-h-[180vh]">
          <Navbar />
          <HomeHero />
        </div>
        <WhyStakeWithUs />
        <WhatWeOffer />
        <Distribution />
      </div>
    </WalletProvider>
  );
}
