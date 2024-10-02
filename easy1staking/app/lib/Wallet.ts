import { Blaze, Blockfrost, CIP30Interface, WebWallet } from "@blaze-cardano/sdk";
import { wallet_name_key } from "./Constants";
import { WalletInfo } from "../components/WalletProvider";


export async function connect(walletName: string, setWallet: (info: WalletInfo) => void) {

    const handle: CIP30Interface = await window.cardano[walletName].enable();

    const provider = new Blockfrost({
      network: 'cardano-mainnet',
      projectId: 'mainnetKWaNkQcrF1erC3u3SZjaFxZiM2M20jFM',
    });

    const blaze = await Blaze.from(provider, new WebWallet(handle));

    const unusedAddress = (await blaze.wallet.getUnusedAddresses())[0];
    const paymentAddress = unusedAddress.toBech32();
    const rewardAddresses = (await blaze.wallet.getRewardAddresses())[0];
    const stakeAddress= rewardAddresses.toAddress().toBech32();

    localStorage.setItem(wallet_name_key, walletName)

    setWallet({
      connected: true,
      walletHandle: handle,
      baseAddress: paymentAddress,
      stakingAddress: stakeAddress  
    });

    const isReconnect = localStorage.getItem(wallet_name_key) != null
    if (!isReconnect) {
      localStorage.setItem(wallet_name_key, walletName)
    }

  }