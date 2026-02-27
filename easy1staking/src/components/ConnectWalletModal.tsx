import React from "react";
import Image from "next/image";
import Vespr from "../../public/Vespr.png";
import Etrnl from "../../public/Etrnl.png";
import Lace from "../../public/Lace.png";
import Typhon from "../../public/Typhon.png";
import { IoIosClose } from "react-icons/io";

const ConnectWalletModal = (props: { isOpen: boolean, onClose: () => void }) => {

  const { isOpen, onClose } = props;

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
          Choose your favourite wallet to log in Easy1.
        </p>
        <div className="space-y-4">
          <button className="w-full flex items-center p-2 border rounded-lg">
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
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConnectWalletModal;
