import {
    BrowserWallet,
    MeshTxBuilder,
    Transaction,
    Wallet,

} from "@meshsdk/core";
import { BLOCKFROST_API_KEY, EASY1_STAKE_POOL_HASH, EASY1_STAKE_POOL_ID } from "./Constants";
import { BlockfrostProvider } from "@meshsdk/core";
import { EASY1DelegationType } from "./AppTypes";

class BlockfrostProviderSingleton {

    private static instance: BlockfrostProvider;

    private constructor() { }

    public static getInstance(): BlockfrostProvider {
        if (!BlockfrostProviderSingleton.instance) {
            console.log('BLOCKFROST_API_KEY: ' + BLOCKFROST_API_KEY);
            BlockfrostProviderSingleton.instance = new BlockfrostProvider(BLOCKFROST_API_KEY!);
        }
        return BlockfrostProviderSingleton.instance;
    }

}

const blockchainProvider = BlockfrostProviderSingleton.getInstance();

class TxBuilderSingleton {

    private static instance: MeshTxBuilder;

    private constructor() { }

    public static getInstance(): MeshTxBuilder {
        if (!TxBuilderSingleton.instance) {
            TxBuilderSingleton.instance = new MeshTxBuilder({
                fetcher: blockchainProvider,
                submitter: blockchainProvider,
            });
        }
        return TxBuilderSingleton.instance;
    }

}

const txBuilder = TxBuilderSingleton.getInstance();

export default class TransactionUtil {

    public static async canBeDelegated(stakingAddress: string): Promise<EASY1DelegationType> {

        return blockchainProvider
            .fetchAccountInfo(stakingAddress)
            .then(accountInfo => {
                console.log('accountInfo: ' + JSON.stringify(accountInfo));
                if (!accountInfo.active) {
                    return EASY1DelegationType.Unregistered;
                } else if (!accountInfo.poolId) {
                    return EASY1DelegationType.Undelegated;
                } else if (accountInfo.poolId == EASY1_STAKE_POOL_ID) {
                    return EASY1DelegationType.Delegated;
                } else {
                    return EASY1DelegationType.DelegatedOther;
                }
            })

    }

    public static async delegate(wallet: BrowserWallet, registerStake: boolean): Promise<string> {
        const unsignedTx = await wallet
            .getRewardAddresses()
            .then((rewardsAddresses) => {
                if (!rewardsAddresses) {
                    return Promise.reject('Wallet has no Staking Credentials');
                } else {
                    const stakeAddress = rewardsAddresses[0];
                    const tx = new Transaction({ initiator: wallet })
                    if (registerStake) tx.registerStake(stakeAddress);
                    tx.delegateStake(stakeAddress, EASY1_STAKE_POOL_ID);
                    return tx.build();
                }
            })
        const signedTx = await wallet.signTx(unsignedTx);
        return wallet.submitTx(signedTx);
    }



}