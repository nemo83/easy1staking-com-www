import React, { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { ThemeProvider, createTheme } from '@mui/material/styles';
import Distribution from "@/components/Distribution";
import { CssBaseline } from "@mui/material";
import TransactionUtil from "@/lib/util/TransactionUtil";
import { EASY1DelegationType } from "@/lib/interfaces/AppTypes";
import { useWallet } from "@meshsdk/react";
import toast from "react-hot-toast";

const WmtConversionPage = () => {

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

  const darkTheme = createTheme({
    palette: {
      mode: 'dark',
    },
  });

  const getButton = () => {

    switch (delegatedType) {
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

  const delegateNow = async () => {
    console.log('delegateNow')
    TransactionUtil
      .delegate(wallet, delegatedType === EASY1DelegationType.Undelegated) // This should be EASY1DelegationType.Unregistered
      .then((txHash) => toast.success('Transaction ' + txHash + ' submitted successfully!'));
  }

  return (
    <div className="wallet-not-connected min-h-[100vh]">
      <Navbar />
      <div className="h-full flex flex-col justify-center items-center">
        <Distribution />
        {getButton()}
      </div>
    </div >
  );
}

export default WmtConversionPage;
