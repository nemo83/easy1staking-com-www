import {
    BrowserWallet,
    conStr,
    mConStr,
    MeshTxBuilder,
    Transaction,
    Wallet,

} from "@meshsdk/core";
import { BLOCKFROST_API_KEY, EASY1_STAKE_POOL_HASH, EASY1_STAKE_POOL_ID, WMT_CONVERSION_SCRIPT } from "./Constants";
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

    public static async convertWMTtoWTMx(wallet: BrowserWallet, wmtBalance: string): Promise<string> {

        const collateral = await wallet.getCollateral();
        const walletUtxos = await wallet.getUtxos();
        const walletAddress = (await wallet.getUsedAddress()).toBech32().toString();
        
        txBuilder.reset();

        const wmtAmount = parseInt(wmtBalance) / 1_000_000;
        
        let fee = '1000000';
        if (wmtAmount > 1_000_000) {
            fee = '50000000';
        } else if (wmtAmount > 100_000) {
            fee = '10000000';
        } else if (wmtAmount > 10_000) {
            fee = '5000000';
        }

        await txBuilder
            .mintPlutusScriptV2()
            .mint(wmtBalance, "e5a42a1a1d3d1da71b0449663c32798725888d2eb0843c4dabeca05a", "576f726c644d6f62696c65546f6b656e58")
            .mintingScript(WMT_CONVERSION_SCRIPT.code)
            .mintRedeemerValue(mConStr(1, []))
            .txOut("addr1x9up2ejdmnuj7q3unah8upuj66e0wvegyjrfjdsnu4ya3dhzvel34wjlssyytuwlk3fhvjnhfs4k0htupktgchqhyjqqc6gya6", [
                {
                    unit: "1d7f33bd23d85e1a25d87d86fac4f199c3197a2f7afeb662a0f34e1e776f726c646d6f62696c65746f6b656e",
                    quantity: wmtBalance
                }
            ])
            .txOut(walletAddress, [
                {
                    unit: "e5a42a1a1d3d1da71b0449663c32798725888d2eb0843c4dabeca05a576f726c644d6f62696c65546f6b656e58",
                    quantity: wmtBalance
                }
            ]).txOut("addr1q8ratxgn92xkwgfhwx054lxyy7eel3maq6zj0xhe8hk6mf2rgt6vrx8paps567pa8qtj9wzah2gpfhme6933fq2vfmnsp7taxn", [
                {
                    unit: "lovelace",
                    quantity: fee
                }
            ])
            .selectUtxosFrom(walletUtxos)
            .changeAddress(walletAddress)
            .txInCollateral(collateral[0].input.txHash, collateral[0].input.outputIndex)
            .complete();

        return txBuilder.txHex;

    }



}