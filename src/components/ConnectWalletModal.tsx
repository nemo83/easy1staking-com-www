import React, { useEffect } from "react";
import Image from "next/image";
import Vespr from "../assets/Vespr.png";
import Etrnl from "../assets/Etrnl.png";
import Lace from "../assets/Lace.png";
import Typhon from "../assets/Typhon.png";
import { IoIosClose } from "react-icons/io";
import { useWallet, useWalletList } from "@meshsdk/react";

const ConnectWalletModal = ({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) => {
  if (!isOpen) return null;
  const { wallet, connected, name, connecting, connect, disconnect, error } =
    useWallet();
  const wallets = useWalletList();

  useEffect(() => {
    if (connected) {
      onClose();
    }
  }, [connected]);

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
          Choose your favourite wallet to log in Easy1.
        </p>
        <div className="space-y-4">
          {wallets.map((wallet, i) => {
            return (
              <button
                key={i}
                className="w-full flex items-center p-2 border rounded-lg"
                onClick={() => connect(wallet.id)}
              >
                <Image
                  src={wallet.icon}
                  alt={wallet.name}
                  className="w-6 h-6 mr-2"
                  width={24}
                  height={24}
                />
                {wallet.name}
              </button>
            );
          })}
          {/* <button className="w-full flex items-center p-2 border rounded-lg">
            <Image src={Vespr} alt="Vespr" className="w-6 h-6 mr-2" />
            Vespr
          </button>
          <button className="w-full flex items-center p-2 border rounded-lg">
            <Image src={Etrnl} alt="Etrnl" className="w-6 h-6 mr-2" />
            Etrnl
          </button>
          <button className="w-full flex items-center p-2 border rounded-lg">
            <Image src={Lace} alt="Lace" className="w-6 h-6 mr-2" />
            Lace
          </button>
          <button className="w-full flex items-center p-2 border rounded-lg">
            <Image src={Typhon} alt="Typhon" className="w-6 h-6 mr-2" />
            Typhon
          </button> */}
        </div>
      </div>
    </div>
  );
};

export default ConnectWalletModal;
