import { Contract, ContractProvider, Sender, Address, Cell, beginCell } from "@ton/core";
import { STAKE_OP_ADD_OPT_SHARE, STAKE_OP_CLAIM_OPT_SHARE, STAKE_OP_DEC_OPT_SHARE } from "../../stakeOp";

export default class OperatorStrategyShare implements Contract {

  constructor(readonly address: Address, readonly init?: { code: Cell, data: Cell }) {}

  async sendValue(provider: ContractProvider, via: Sender, value: string) {
    await provider.internal(via, {
      value, // send TON to contract for rent
    });
  }

  static createForDeploy(address: Address): OperatorStrategyShare {
    return new OperatorStrategyShare(address);
  }

  async sendAddOptShare(provider: ContractProvider, via: Sender, queryId: number, deltaShares: bigint, needAck: boolean, extraPayload: Cell, value: string) {
    const messageBody = beginCell()
      .storeUint(STAKE_OP_ADD_OPT_SHARE, 32) // op 
      .storeUint(queryId, 64) // query id
      .storeCoins(deltaShares)
      .storeUint(needAck ? 1 : 0, 1)
      .storeRef(extraPayload)
      .endCell();
    await provider.internal(via, {
      value,
      body: messageBody
    });
  }

  async sendDecOptShare(provider: ContractProvider, via: Sender, queryId: number, deltaShares: bigint, needAck: boolean, extraPayload: Cell, value: string) {
    const messageBody = beginCell()
      .storeUint(STAKE_OP_DEC_OPT_SHARE, 32) // op 
      .storeUint(queryId, 64) // query id
      .storeCoins(deltaShares)
      .storeUint(needAck ? 1 : 0, 1)
      .storeRef(extraPayload)
      .endCell();
    await provider.internal(via, {
      value,
      body: messageBody
    });
  }

  async sendClaimShares(provider: ContractProvider, via: Sender, queryId: number, recipient: Address, value: string) {
    const messageBody = beginCell()
      .storeUint(STAKE_OP_CLAIM_OPT_SHARE, 32) // op 
      .storeUint(queryId, 64) // query id
      .storeAddress(recipient)
      .endCell();
    await provider.internal(via, {
      value,
      body: messageBody
    });
  }

  async getOperatorStrategyShareData(provider: ContractProvider) {
    const { stack } = await provider.get("get_operator_strategy_share_data", []);
    
    const shares = stack.readBigNumber();
    const operatorAddress = stack.readAddress();
    const strategyAddress = stack.readAddress();
    return {
        shares,
        operatorAddress,
        strategyAddress
    };
  }

}