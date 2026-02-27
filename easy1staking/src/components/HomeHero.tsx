import React, { useEffect, useState } from "react";
import Coin from "../../public/Coin.png";
import Image from "next/image";
import { useWallet } from "@meshsdk/react";
import TransactionUtil from "@/lib/util/TransactionUtil";
import { Address, AddressType } from "@meshsdk/core-cst";
import toast from "react-hot-toast";
import { duration } from "@mui/material";
import { EASY1DelegationType } from "@/lib/interfaces/AppTypes";

const HomeHero = () => {

  const { wallet, connected } = useWallet();

  const [delegatedType, setDelegatedType] = useState<EASY1DelegationType>(EASY1DelegationType.ConnectWallet);

  useEffect(() => {
    if (connected) {
      wallet
        .getRewardAddresses()
        .then((rewardAddresses) => {
          if (!rewardAddresses) {
            console.log('no reward addresses')
            return Promise.resolve(EASY1DelegationType.UnsupportedWallet)
          } else {
            console.log('rewards addresses: ' + JSON.stringify(rewardAddresses));
            const stakeAddress = rewardAddresses.shift()!;
            return TransactionUtil.canBeDelegated(stakeAddress)
          }
        })
        .then(delegatedType => {
          console.log('delegatedType: ' + delegatedType)
          setDelegatedType(delegatedType)
        })

    } else {
      setDelegatedType(EASY1DelegationType.ConnectWallet)
    }
  }, [connected]);


  const delegateNow = async () => {
    console.log('delegateNow')
    TransactionUtil
      .delegate(wallet, delegatedType === EASY1DelegationType.Undelegated) // This should be EASY1DelegationType.Unregistered
      .then((txHash) => toast.success('Transaction ' + txHash + ' submitted successfully!'));
  }

  const getButton = (delegationType: EASY1DelegationType) => {

    switch (delegationType) {
      case EASY1DelegationType.ConnectWallet:
        return (
          <button disabled className="font-semibold px-5 p-3 mt-10 rounded-full bg-gray-400">
            Connect Wallet to Delegate
          </button>
        )
      case EASY1DelegationType.Delegated:
        return (
          <button className="font-semibold px-5 p-3 mt-10 rounded-full bg-[#304FFE]">
            You&apos;re all set already!
          </button>
        )
      case EASY1DelegationType.Unregistered:
      case EASY1DelegationType.Undelegated:
      case EASY1DelegationType.DelegatedOther:
        return (
          <button className="font-semibold px-5 p-3 mt-10 rounded-full bg-[#304FFE]" onClick={() => delegateNow()}>
            Delegate NOW!
          </button>
        )
      default:
        return (
          <button disabled className="font-semibold px-5 p-3 mt-10 rounded-full bg-gray-400">
            Unsupported Wallet
          </button>
        );

    }
  }

  return (
    <div className="mt-20 flex flex-col-reverse md:flex-row justify-center items-center md:justify-between  container mx-auto">
      <div className=" p-5 md:px-0">
        <h1 className="text-[30px] sm:text-[40px] md:text-[60px] lg:text-[80px] font-semibold">
          Simple, Secure <br />& Rewarding
        </h1>
        <p className="text-[#DDDDDD] w-[100%] md:w-[60%]">
          Since launching in 2020, EASY1 has minted over 2k blocks, staked over
          12 million ADA and attracted a community of more than 800 delegators.
        </p>
        {getButton(delegatedType)}
      </div>
      <div className="p-5 md:px-0">
        <Image src={Coin} alt="Cardano Coin"/>
      </div>
    </div>
  );
}

export default HomeHero;
