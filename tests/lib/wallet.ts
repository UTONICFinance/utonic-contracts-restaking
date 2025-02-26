import { Address } from "@ton/core";
import { Blockchain } from "@ton/sandbox";


export const getWalletAddress = async (minter: any, userAddress: Address) => {
    return await minter.getWalletAddress(userAddress);
}

export const getWalletContract = async (minter: any, WalletContractClass: any, blockchain: Blockchain, userAddress: Address) => {
    const walletAddress = await getWalletAddress(minter, userAddress);
    const wallet = new WalletContractClass(walletAddress);
    return blockchain.openContract(wallet);
}

export const getWalletData = async (minter: any, WalletContractClass: any, blockchain: Blockchain, userAddress: Address) => {
    const walletContract = await getWalletContract(minter, WalletContractClass, blockchain, userAddress)
    return await walletContract.getWalletData();
}