"use client";
import React, { useState } from "react";
import Footer from "./Footer";
import PoolDetails from "./PoolDetails";

function Distribution() {
  const [walletAddress, setWalletAddress] = useState("");
  const [pool, setPool] = useState(false);
  const [checkBtn, setCheckBtn] = useState(false);
  const check = () => {
    if (walletAddress && !pool) {
      setPool(true); // Set pool to true if walletAddress exists
      setCheckBtn(true); // Set checkBtn to true
    } else {
      setWalletAddress(""); // Clear walletAddress if it doesn't exist
      setPool(false); // Set pool to false
      setCheckBtn(false); // Set checkBtn to false
      console.log("Wallet address is not present.");
    }
  };

  return (
    <div className="Distribution min-h-[100vh]">
      <div className="min-h-[100vh] flex flex-col justify-center items-center">
        <h1 className="text-[34px] sm:text-[54px] md:text-[64px] py-20 font-semibold ">
          Compare Rewards
        </h1>
        <div className="relative flex justify-center items-center h-10 w-[300px] sm:w-[400px] md:w-[600px] mt-10">
          <button
            className={`!absolute right-5 z-10 select-none rounded-[20px]   ${
              checkBtn
                ? "bg-none text-[#304FFE] border border-[#304FFE]"
                : walletAddress
                ? "bg-[#304FFE]"
                : "bg-[#acb9ff]"
            }
 py-3 px-6  text-center align-middle  font-sans font-semibold  shadow-md  transition-all   focus:shadow-none active:opacity-[0.85] active:shadow-none peer-placeholder-shown:pointer-events-none peer-placeholder-shown:bg-blue-gray-500 peer-placeholder-shown:opacity-50 peer-placeholder-shown:shadow-none`}
            type="button"
            onClick={check}
          >
            {checkBtn ? " Clear" : "Check"}
          </button>
          <input
            type="text"
            className="peer h-full w-full rounded-3xl p-8 pr-20 font-sans text-sm font-normal transition-all  focus:border-t-transparent focus:outline-0 text-[#000000DE]"
            placeholder="Wallet Address"
            value={walletAddress}
            onChange={(e) => {
              setWalletAddress(e.target.value);
            }}
          />
        </div>
        {pool && <PoolDetails />}
      </div>
      <Footer />
    </div>
  );
}

export default Distribution;
