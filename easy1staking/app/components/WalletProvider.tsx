'use client';
import { createContext, useContext, useState, FC, ReactNode } from "react";
import { CIP30Interface, Wallet } from "@blaze-cardano/sdk"

export interface WalletInfo {
    connected: boolean,
    walletHandle: CIP30Interface | undefined,
    baseAddress: string | undefined,
    stakingAddress: string | undefined,
}

export interface WalletContextType {
    walletInfo: WalletInfo | undefined,
    setWallet: (info: WalletInfo) => void
}

export const noWallet = {
    connected: false,
    walletHandle: undefined,
    baseAddress: undefined,
    stakingAddress: undefined
}

const WalletContext = createContext<WalletContextType | null>({
    walletInfo: noWallet,
    setWallet: (info: WalletInfo) => { },
});

interface MyProps {
    children?: ReactNode;
}

const WalletProvider: FC<MyProps> = (props) => {
    const [walletInfo, setWalletInfo] = useState(null);

    const setWallet = (info: WalletInfo) => {
        setWalletInfo(info)
    }

    return (
        <WalletContext.Provider value={{ walletInfo, setWallet }}>
            {props.children}
        </WalletContext.Provider>
    );
}


export default WalletProvider;

export function useWalletContext() {
    return useContext(WalletContext);
}