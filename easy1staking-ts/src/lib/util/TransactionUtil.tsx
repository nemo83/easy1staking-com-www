import {
    MeshTxBuilder,

} from "@meshsdk/core";
import { BLOCKFROST_API_KEY, EASY1_STAKE_POOL_ID } from "./Constants";
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
                if (!accountInfo.poolId) {
                    return EASY1DelegationType.Undelegated;
                } else if (accountInfo.poolId == EASY1_STAKE_POOL_ID) {
                    return EASY1DelegationType.Delegated;
                } else {
                    return EASY1DelegationType.DelegatedOther;
                }
            })

    }


}