"use client";
import React, { useEffect, useState } from "react";
import Footer from "./Footer";
import PoolDetails from "./PoolDetails";
import { useWallet } from "@meshsdk/react";
import { StakePoolAssessment } from "@/lib/interfaces/AppTypes";
import { EASY1STAKING_API } from "@/lib/util/Constants";
import toast from "react-hot-toast";
import { RepeatOneSharp } from "@mui/icons-material";

const Distribution = () => {

  const { wallet, connected } = useWallet();

  const [walletAddress, setWalletAddress] = useState("");
  const [checkBtn, setCheckBtn] = useState(false);
  const [stakePoolAssessment, setStakePoolAssessment] = useState<StakePoolAssessment | undefined>(undefined)

  useEffect(() => {
    if (connected) {
      wallet.getUsedAddress()
        .then((address) => {
          setWalletAddress(address.toBech32().toString());
        })
    } else {
      setWalletAddress("");
    }
  }, [connected]);

  const check = async () => {

    fetch(EASY1STAKING_API + '/stake_assessment/' + walletAddress)
      .then(response => {
        if (response.ok) {
          return response.json();
        } else {
          throw new Error('Error while fetching stake data: ' + response.status);
        }
      })
      .then((data: StakePoolAssessment) => Promise.resolve(setStakePoolAssessment(data)))
      .catch(error => {
        toast.error('Error while calculating stake rewards', { duration: 5000 });
      })

  };

  return (
    <div className="Distribution min-h-[100vh]">
      <div className="min-h-[100vh] flex flex-col justify-center items-center">
        <h1 className="text-[34px] sm:text-[54px] md:text-[64px] py-20 font-semibold ">
          Compare Rewards
        </h1>
        <div className="relative flex justify-center items-center h-10 w-[300px] sm:w-[400px] md:w-[600px] mt-10">
          <button
            className={`!absolute right-5 z-10 select-none rounded-[20px]   ${checkBtn
              ? "bg-none text-[#304FFE] border border-[#304FFE]"
              : walletAddress
                ? "bg-[#304FFE]"
                : "bg-[#acb9ff]"
              }
 py-3 px-6  text-center align-middle  font-sans font-semibold  shadow-md  transition-all   focus:shadow-none active:opacity-[0.85] active:shadow-none peer-placeholder-shown:pointer-events-none peer-placeholder-shown:bg-blue-gray-500 peer-placeholder-shown:opacity-50 peer-placeholder-shown:shadow-none`}
            type="button"
            onClick={() => check()}
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
        {stakePoolAssessment && <PoolDetails stakePoolAssessment={stakePoolAssessment} />}
      </div>
      <Footer />
    </div>
  );
}

export default Distribution;
