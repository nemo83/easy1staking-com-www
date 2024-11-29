import React from "react";
import Navbar from "../../components/Navbar";
import RafflesHero from "../../components/RafflesHero";
import DataTable from "../../components/DataTable";
import Footer from "../../components/Footer";

function page() {
  return (
    <div>
      <div className="raffles min-h-[100vh]">
        <Navbar />
        <RafflesHero />
        <h1 className="text-[34px] sm:text-[54px] md:text-[64px] py-20  font-semibold text-center">
          Recent Closed Raffles
        </h1>
        <div className="container mx-auto my-10">
          <DataTable />
        </div>
      </div>
      <Footer />
    </div>
  );
}

export default page;
