import Head from "next/head";
import { CardanoWallet, MeshBadge } from "@meshsdk/react";
import Navbar from "@/components/Navbar";
import HomeHero from "@/components/HomeHero";

export default function Home() {
  return (
    <div className="home-bg">
      <div className="home-hero min-h-[180vh]">
        <Navbar wallet={false} />
        <HomeHero />
      </div>
      {/* <WhyStakeWithUs />
      <WhatWeOffer />
      <Distribution /> */}
    </div>
  );
}
