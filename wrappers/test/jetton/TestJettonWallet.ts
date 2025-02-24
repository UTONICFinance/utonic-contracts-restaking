import { Contract, ContractProvider, Sender, Address, Cell, contractAddress, beginCell, Slice, TupleItemSlice, TupleItemInt, Dictionary } from "@ton/core";
import { JETTON_OP_TRANSFER } from "../../standard/opcodes";

export default class TestJettonWallet implements Contract {

  constructor(readonly address: Address, readonly init?: { code: Cell, data: Cell }) {}

  async sendTransfer(provider: ContractProvider, via: Sender, queryId: number, jettonAmount: bigint, toAddress: Address, responseAddress: Address, value: string, fwdValue: string) {
    const messageBody = beginCell()
      .storeUint(JETTON_OP_TRANSFER, 32) // op 
      .storeUint(queryId, 64) // query id
      .storeCoins(jettonAmount)
      .storeAddress(toAddress)
      .storeAddress(responseAddress)
      .storeDict(Dictionary.empty())
      .storeCoins(BigInt(Number(fwdValue) * 1e9))
      .storeUint(1, 8)
      .endCell();
    await provider.internal(via, {
      value,
      body: messageBody
    });
  }

  async getWalletData(provider: ContractProvider) {
    const { stack } = await provider.get("get_wallet_data", []);
    return {
      balance: stack.readBigNumber(),
      owner: stack.readAddress(),
      minter: stack.readAddress(),
    };
  }

}