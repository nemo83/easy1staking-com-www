"use client";
import React, { useEffect, useState } from "react";
import Footer from "./Footer";
import PoolDetails from "./PoolDetails";
import AirdropEligibilityTable from "./AirdropEligibilityTable";
import { useWallet } from "@meshsdk/react";
import { StakePoolAssessment } from "@/lib/interfaces/AppTypes";
import { EASY1STAKING_API } from "@/lib/util/Constants";
import toast from "react-hot-toast";
import { RepeatOneSharp } from "@mui/icons-material";
import { resolveRewardAddress } from '@meshsdk/core';

const Distribution = () => {

  const { wallet, connected } = useWallet();

  const [walletAddress, setWalletAddress] = useState("");
  const [stakeAddress, setStakeAddress] = useState<string | undefined>(undefined);
  const [checkBtn, setCheckBtn] = useState(false);
  const [stakePoolAssessment, setStakePoolAssessment] = useState<StakePoolAssessment | undefined>(undefined)

  useEffect(() => {
    if (connected) {

      wallet.getUsedAddresses()
        .then((address) => {
          setWalletAddress(address[0]);
        })

      wallet
        .getRewardAddresses()
        .then((rewardAddresses) => {
          if (rewardAddresses) {
            console.log('rewards addresses: ' + JSON.stringify(rewardAddresses));
            const stakeAddress = rewardAddresses.shift()!;
            setStakeAddress(stakeAddress);
          }
        })

    } else {
      setWalletAddress("");
      setStakeAddress(undefined);
    }
  }, [connected, wallet]);

  useEffect(() => {

    if (walletAddress) {

      if (walletAddress.startsWith("stake1")) {
        setStakeAddress(walletAddress);
      } else {
        try {
          const stakeAddress = resolveRewardAddress(walletAddress);
          if (stakeAddress) {
            setStakeAddress(stakeAddress);
          }
        } catch (error) {
          console.log('Invalid address format');
        }
      }

    }


  }, [walletAddress])


  const check = async () => {
    setCheckBtn(true);

    fetch(EASY1STAKING_API + '/stake_assessment/' + walletAddress)
      .then(response => {
        if (response.ok) {
          return response.json();
        } else {
          throw new Error('Error while fetching stake data: ' + response.status);
        }
      })
      .then((data: StakePoolAssessment) => {
        setStakePoolAssessment(data);
      })
      .catch(error => {
        toast.error('Error while calculating stake rewards', { duration: 5000 });
        setCheckBtn(false);
      })
  };

  const clearResults = () => {
    setStakePoolAssessment(undefined);
    setCheckBtn(false);
  };

  // Check if user is already delegated to EASY1 stake pool
  const isAlreadyDelegatedToEasy1 = () => {
    if (!stakePoolAssessment?.current_pool) return false;
    return stakePoolAssessment.current_pool.ticker === 'EASY1';
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
            onClick={() => checkBtn ? clearResults() : check()}
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
        {stakePoolAssessment && (
          <div className="w-full max-w-6xl mx-auto px-4">
            <PoolDetails stakePoolAssessment={stakePoolAssessment} />
            
            {/* Show Airdrop Eligibility only if NOT delegated to EASY1 */}
            {stakeAddress && !isAlreadyDelegatedToEasy1() && (
              <div className="mt-8">
                <AirdropEligibilityTable
                  stakeBalance={stakePoolAssessment.stake_balance}
                  walletAddress={stakeAddress}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default Distribution;
