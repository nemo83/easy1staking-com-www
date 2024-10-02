'use client';
import { createContext, useContext, useState, FC, ReactNode } from "react";
import { CIP30Interface } from "@blaze-cardano/sdk"

export interface WalletContext {
    connected: boolean,
    walletHandle: CIP30Interface | undefined,
    baseAddress: string,
    stakingAddress: string | undefined
}

const Context = createContext({});

interface MyProps {
    children?: ReactNode;
}

const WalletProvider: FC<MyProps> = (props) => {
    const [walletHandle, setWalletHandle] = useState(null);
    return (
        <Context.Provider value={[walletHandle, setWalletHandle]}>{props.children}</Context.Provider>
    );
}


export default WalletProvider;

export function useWalletContext() {
    return useContext(Context);
}