import Head from "next/head";
import { CardanoWallet, MeshBadge } from "@meshsdk/react";
import Navbar from "@/components/Navbar";
import HomeHero from "@/components/HomeHero";
import WhyStakeWithUs from "@/components/WhyStakeWithUs";

export default function Home() {
  return (
    <div className="home-bg">
      <div className="home-hero min-h-[180vh]">
        <Navbar />
        <HomeHero />
      </div>
      <WhyStakeWithUs />
      {/* <WhatWeOffer />
      <Distribution /> */}
    </div>
  );
}
