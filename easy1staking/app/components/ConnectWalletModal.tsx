import React, { useEffect } from "react";
import Image from "next/image";

import { IoIosClose } from "react-icons/io";
import { useWalletContext } from "./WalletProvider";
import { Blaze, Blockfrost, CIP30Interface, WebWallet } from "@blaze-cardano/sdk";
import { toast } from "react-toastify";
import { wallet_name_key } from "../lib/Constants";
import { connect } from "../lib/Wallet";

const ConnectWalletModal = ({ isOpen, onClose, availableWallets }) => {

  const { walletInfo, setWallet } = useWalletContext()

  const handleConnect = async (walletName: string) => 
    connect(walletName, info => setWallet(info)).then(() => {
      toast.success('Wallet correctly connected!');
      onClose();
    })


  useEffect(() => {
    console.log('wallet handle changed!');
  }, [walletInfo]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 bg-black text-black bg-opacity-50">
      <div className="bg-white rounded-3xl p-6 pb-10 w-full max-w-md">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl mb-3 font-bold mt-10">Connect Wallet</h2>
          <button onClick={onClose} className="text-xl font-bold">
            <IoIosClose size={40} />
          </button>
        </div>
        <p className="text-gray-600 mb-4">
          Choose your favourite wallet to log on EASY1.
        </p>
        <div className="space-y-4">
          {availableWallets.map((wallet: any, i: number) => (
            <button className="w-full flex items-center p-2 border rounded-lg" key={i} onClick={() => handleConnect(wallet.name)}>
              <Image src={wallet.icon} alt={wallet.name} className="w-6 h-6 mr-2" width="30" height="30" />
              {wallet.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ConnectWalletModal;
