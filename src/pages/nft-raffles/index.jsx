import React from "react";
import Navbar from "../../components/Navbar";
import DataTable from "../../components/DataTable";
import Footer from "../../components/Footer";
import NFTHero from "../../components/NFTHero";
import NFTDataTable from "../../components/NFTDataTable";

function page() {
  return (
    <div>
      <div className="raffles min-h-[100vh]">
        <Navbar />
        <NFTHero />
        <h1 className="text-[34px] sm:text-[54px] md:text-[64px] py-20  font-semibold text-center">
          Previous Raffles
        </h1>
        <div className="container mx-auto my-10">
          <NFTDataTable />
        </div>
      </div>
      <Footer />
    </div>
  );
}

export default page;
