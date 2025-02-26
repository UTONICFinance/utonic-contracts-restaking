import { Contract, ContractProvider, Sender, Address, Cell, contractAddress, beginCell, Slice, TupleItemSlice, TupleItemInt, Dictionary } from "@ton/core";
import { STRATEGY_OP_ADMIN_ADD_USER_SHARE, STRATEGY_OP_ADMIN_CANCEL_USER_PENDING, STRATEGY_OP_ADMIN_DELEGATE_ACK, STRATEGY_OP_ADMIN_EXTRACT_TOKEN, STRATEGY_OP_ADMIN_EXTRACT_TON, STRATEGY_OP_ADMIN_UNDELEGATE_ACK, STRATEGY_OP_ADMIN_UPDATE_OPERATOR_SHARE, STRATEGY_OP_ADMIN_UPDATE_TOKEN_RECEIVER, STRATEGY_OP_ADMIN_UPDATE_UTONIC_MANAGER, STRATEGY_OP_ADMIN_UPDATE_WITHDRAW_PENDING_TIME, STRATEGY_OP_INIT_USER_INFO } from "../strategyOp";
import { STAKE_OP_ADMIN_ACCEPT_ADMIN, STAKE_OP_ADMIN_UPDATE_ADMIN, STAKE_OP_ADMIN_UPDATE_CODE, STAKE_OP_BURN, STAKE_OP_CLAIM_OPT_SHARE, STAKE_OP_CLAIM_OPT_SHARE_ACK, STAKE_OP_DELEGATE, STAKE_OP_DEPOSIT, STAKE_OP_DEPOSIT_ACK, STAKE_OP_QUERY_ACK, STAKE_OP_UNDELEGATE, STAKE_OP_UPDATE_OPT_SHARE_ACK, STAKE_OP_WITHDRAW } from "../../stakeOp";

export default class StrategyTon implements Contract {

  static initData(
    strategyId: number,
    withdrawPendingTime: number,
    utonicManagerAddress: Address,
    tonReceiverAddress: Address,
    adminAddress: Address,
    userStrategyInfoCode: Cell,
    operatorStrategyShareCode: Cell,
    withdrawCode: Cell,
  ): Cell {
    const totalShares = 0;
    const debtToken = 0;
    const dataCell = beginCell()
        .storeUint(strategyId, 32)
        .storeUint(withdrawPendingTime, 64)
        .storeCoins(totalShares)
        .storeCoins(debtToken)
        .endCell();
    const pendingAdminAddress = adminAddress;
    const adminCell = beginCell()
        .storeAddress(adminAddress)
        .storeAddress(pendingAdminAddress)
        .endCell();
    const addressCell = beginCell()
        .storeAddress(utonicManagerAddress)
        .storeAddress(tonReceiverAddress)
        .storeRef(adminCell)
        .endCell();
    const codeCell = beginCell()
        .storeRef(userStrategyInfoCode)
        .storeRef(operatorStrategyShareCode)
        .storeRef(withdrawCode)
        .endCell();
    return beginCell()
        .storeRef(dataCell)
        .storeRef(addressCell)
        .storeRef(codeCell)
        .endCell();
  }

  static createForDeploy(code: Cell, data: Cell): StrategyTon {
    const workchain = 0; // deploy to workchain 0
    const address = contractAddress(workchain, { code, data });
    return new StrategyTon(address, { code, data });
  }

  constructor(readonly address: Address, readonly init?: { code: Cell, data: Cell }) {}

  async sendDeploy(provider: ContractProvider, via: Sender, value: string) {
    await provider.internal(via, {
      value, // send TON to contract for rent
      bounce: false
    });
  }

  async sendValue(provider: ContractProvider, via: Sender, value: string) {
    await provider.internal(via, {
      value, // send TON to contract for rent
    });
  }

  async sendInitUserInfo(provider: ContractProvider, via: Sender, queryId: number, responseAddress: Address, value: string) {
    const messageBody = beginCell()
      .storeUint(STRATEGY_OP_INIT_USER_INFO, 32) // op 
      .storeUint(queryId, 64) // query id
      .storeAddress(responseAddress)
      .endCell();
    await provider.internal(via, {
      value,
      body: messageBody
    });
  }

  async sendDeposit(provider: ContractProvider, via: Sender, queryId: number, shares: bigint, responseAddress: Address, value: string) {
    const messageBody = beginCell()
      .storeUint(STAKE_OP_DEPOSIT, 32) // op 
      .storeUint(queryId, 64) // query id
      .storeCoins(shares)
      .storeAddress(responseAddress)
      .endCell();
    await provider.internal(via, {
      value,
      body: messageBody
    });
  }

  async sendDepositAck(provider: ContractProvider, via: Sender, queryId: number, shares: bigint, userAddress: Address, value: string) {
    const messageBody = beginCell()
      .storeUint(STAKE_OP_DEPOSIT_ACK, 32) // op 
      .storeUint(queryId, 64) // query id
      .storeCoins(shares)
      .storeAddress(userAddress)
      .endCell();
    await provider.internal(via, {
      value,
      body: messageBody
    });
  }
  
  async sendBurn(provider: ContractProvider, via: Sender, queryId: number, shares: bigint, withdrawId: number, userAddress: Address, responseAddress: Address, value: string) {
    const messageBody = beginCell()
      .storeUint(STAKE_OP_BURN, 32) // op 
      .storeUint(queryId, 64) // query id
      .storeCoins(shares)
      .storeUint(withdrawId, 64)
      .storeRef(
        beginCell()
            .storeAddress(userAddress)
            .storeAddress(responseAddress)
        .endCell())
      .endCell();
    await provider.internal(via, {
      value,
      body: messageBody
    });
  }

  async sendWithdraw(provider: ContractProvider, via: Sender, queryId: number, shares: bigint, withdrawId: number, userAddress: Address, recipientAddress: Address, responseAddress: Address, value: string) {
    const messageBody = beginCell()
      .storeUint(STAKE_OP_WITHDRAW, 32) // op 
      .storeUint(queryId, 64) // query id
      .storeCoins(shares)
      .storeUint(withdrawId, 64)
      .storeAddress(userAddress)
      .storeRef(
        beginCell()
            .storeAddress(recipientAddress)
            .storeAddress(responseAddress)
        .endCell())
      .endCell();
    await provider.internal(via, {
      value,
      body: messageBody
    });
  }

  async sendDelegate(provider: ContractProvider, via: Sender, queryId: number, shares: bigint, userAddress: Address, operatorAddress: Address, responseAddress: Address, value: string) {
    const messageBody = beginCell()
      .storeUint(STAKE_OP_DELEGATE, 32) // op 
      .storeUint(queryId, 64) // query id
      .storeCoins(shares)
      .storeAddress(userAddress)
      .storeRef(
        beginCell()
            .storeAddress(operatorAddress)
            .storeAddress(responseAddress)
        .endCell())
      .endCell();
    await provider.internal(via, {
      value,
      body: messageBody
    });
  }

  async sendUndelegate(provider: ContractProvider, via: Sender, queryId: number, shares: bigint, userAddress: Address, operatorAddress: Address, responseAddress: Address, value: string) {
    const messageBody = beginCell()
      .storeUint(STAKE_OP_UNDELEGATE, 32) // op 
      .storeUint(queryId, 64) // query id
      .storeCoins(shares)
      .storeAddress(userAddress)
      .storeRef(
        beginCell()
            .storeAddress(operatorAddress)
            .storeAddress(responseAddress)
        .endCell())
      .endCell();
    await provider.internal(via, {
      value,
      body: messageBody
    });
  }

  async sendQueryAck(provider: ContractProvider, via: Sender, queryId: number, operatorStatus: number, operatorAddress: Address, responseAddress: Address, inExtraPayload: Cell, value: string) {
    const messageBody = beginCell()
      .storeUint(STAKE_OP_QUERY_ACK, 32) // op 
      .storeUint(queryId, 64) // query id
      .storeUint(operatorStatus, 2)
      .storeAddress(operatorAddress)
      .storeAddress(responseAddress)
      .storeRef(inExtraPayload)
      .endCell();
    await provider.internal(via, {
      value,
      body: messageBody
    });
  }

  async sendUpdateOptShareAck(provider: ContractProvider, via: Sender, queryId: number, operatorAddress: Address, responseAddress: Address, inExtraPayload: Cell, value: string) {
    const messageBody = beginCell()
      .storeUint(STAKE_OP_UPDATE_OPT_SHARE_ACK, 32) // op 
      .storeUint(queryId, 64) // query id
      .storeAddress(operatorAddress)
      .storeAddress(responseAddress)
      .storeRef(inExtraPayload)
      .endCell();
    await provider.internal(via, {
      value,
      body: messageBody
    });
  }

  async sendClaimOptShare(provider: ContractProvider, via: Sender, queryId: number, operatorAddress: Address, recipientAddress: Address, value: string) {
    const messageBody = beginCell()
      .storeUint(STAKE_OP_CLAIM_OPT_SHARE, 32) // op 
      .storeUint(queryId, 64) // query id
      .storeAddress(operatorAddress)
      .storeAddress(recipientAddress)
      .endCell();
    await provider.internal(via, {
      value,
      body: messageBody
    });
  }

  async sendClaimOptShareAck(provider: ContractProvider, via: Sender, queryId: number, shares: bigint, operatorAddress: Address, recipientAddress: Address, value: string) {
    const messageBody = beginCell()
      .storeUint(STAKE_OP_CLAIM_OPT_SHARE_ACK, 32) // op 
      .storeUint(queryId, 64) // query id
      .storeCoins(shares)
      .storeAddress(operatorAddress)
      .storeAddress(recipientAddress)
      .endCell();
    await provider.internal(via, {
      value,
      body: messageBody
    });
  }

  async sendAdminExtractToken(provider: ContractProvider, via: Sender, queryId: number, amount: bigint, responseAddress: Address, value: string) {
    const messageBody = beginCell()
      .storeUint(STRATEGY_OP_ADMIN_EXTRACT_TON, 32) // op 
      .storeUint(queryId, 64) // query id
      .storeCoins(amount)
      .storeAddress(responseAddress)
      .endCell();
    await provider.internal(via, {
      value,
      body: messageBody
    });
  }

  async sendAdminCancelUserPending(provider: ContractProvider, via: Sender, queryId: number, userStrategyInfoAddress: Address, value: string) {
    const messageBody = beginCell()
      .storeUint(STRATEGY_OP_ADMIN_CANCEL_USER_PENDING, 32) // op 
      .storeUint(queryId, 64) // query id
      .storeAddress(userStrategyInfoAddress)
      .endCell();
    await provider.internal(via, {
      value,
      body: messageBody
    });
  }

  async sendAdminDelegateAck(provider: ContractProvider, via: Sender, queryId: number, userStrategyInfoAddress: Address, responseAddress: Address, value: string) {
    const messageBody = beginCell()
      .storeUint(STRATEGY_OP_ADMIN_DELEGATE_ACK, 32) // op 
      .storeUint(queryId, 64) // query id
      .storeAddress(userStrategyInfoAddress)
      .storeAddress(responseAddress)
      .endCell();
    await provider.internal(via, {
      value,
      body: messageBody
    });
  }

  async sendAdminUndelegateAck(provider: ContractProvider, via: Sender, queryId: number, userStrategyInfoAddress: Address, responseAddress: Address, value: string) {
    const messageBody = beginCell()
      .storeUint(STRATEGY_OP_ADMIN_UNDELEGATE_ACK, 32) // op 
      .storeUint(queryId, 64) // query id
      .storeAddress(userStrategyInfoAddress)
      .storeAddress(responseAddress)
      .endCell();
    await provider.internal(via, {
      value,
      body: messageBody
    });
  }

  async sendAdminUpdateOperatorShare(provider: ContractProvider, via: Sender, queryId: number, operatorStrategyShareAddress: Address, delta: bigint, value: string) {
    const messageBody = beginCell()
      .storeUint(STRATEGY_OP_ADMIN_UPDATE_OPERATOR_SHARE, 32) // op 
      .storeUint(queryId, 64) // query id
      .storeUint(delta > 0n ? 1 : 0, 1)
      .storeCoins(delta > 0n? delta : -delta)
      .storeAddress(operatorStrategyShareAddress)
      .endCell();
    await provider.internal(via, {
      value,
      body: messageBody
    });
  }

  async sendAdminUpdateAdmin(provider: ContractProvider, via: Sender, queryId: number, pendingAdminAddress: Address, value: string) {
    const messageBody = beginCell()
      .storeUint(STAKE_OP_ADMIN_UPDATE_ADMIN, 32) // op 
      .storeUint(queryId, 64) // query id
      .storeAddress(pendingAdminAddress)
      .endCell();
    await provider.internal(via, {
      value,
      body: messageBody
    });
  }

  async sendAdminAcceptAdmin(provider: ContractProvider, via: Sender, queryId: number, value: string) {
    const messageBody = beginCell()
      .storeUint(STAKE_OP_ADMIN_ACCEPT_ADMIN, 32) // op 
      .storeUint(queryId, 64) // query id
      .endCell();
    await provider.internal(via, {
      value,
      body: messageBody
    });
  }

  async sendAdminUpdateCode(provider: ContractProvider, via: Sender, queryId: number, code: Cell, value: string) {
    const messageBody = beginCell()
      .storeUint(STAKE_OP_ADMIN_UPDATE_CODE, 32) // op 
      .storeUint(queryId, 64) // query id
      .storeRef(code)
      .endCell();
    await provider.internal(via, {
      value,
      body: messageBody
    });
  }

  async sendAdminUpdateUtonicManager(provider: ContractProvider, via: Sender, queryId: number, utonicManager: Address, value: string) {
    const messageBody = beginCell()
      .storeUint(STRATEGY_OP_ADMIN_UPDATE_UTONIC_MANAGER, 32) // op 
      .storeUint(queryId, 64) // query id
      .storeAddress(utonicManager)
      .endCell();
    await provider.internal(via, {
      value,
      body: messageBody
    });
  }

  async sendAdminUpdateTokenReceiver(provider: ContractProvider, via: Sender, queryId: number, tokenReceiver: Address, value: string) {
    const messageBody = beginCell()
      .storeUint(STRATEGY_OP_ADMIN_UPDATE_TOKEN_RECEIVER, 32) // op 
      .storeUint(queryId, 64) // query id
      .storeAddress(tokenReceiver)
      .endCell();
    await provider.internal(via, {
      value,
      body: messageBody
    });
  }

  async sendAdminUpdateWithdrawPendingTime(provider: ContractProvider, via: Sender, queryId: number, withdrawPendingTime: number, value: string) {
    const messageBody = beginCell()
      .storeUint(STRATEGY_OP_ADMIN_UPDATE_WITHDRAW_PENDING_TIME, 32) // op 
      .storeUint(queryId, 64) // query id
      .storeUint(withdrawPendingTime, 32)
      .endCell();
    await provider.internal(via, {
      value,
      body: messageBody
    });
  }

  async sendAdminAddUserShare(provider: ContractProvider, via: Sender, queryId: number, share: bigint, userAddress: Address, responseAddress: Address, value: string) {
    const messageBody = beginCell()
      .storeUint(STRATEGY_OP_ADMIN_ADD_USER_SHARE, 32) // op 
      .storeUint(queryId, 64) // query id
      .storeCoins(share)
      .storeAddress(userAddress)
      .storeAddress(responseAddress)
      .endCell();
    await provider.internal(via, {
      value,
      body: messageBody
    });
  }

  async getStrategyData(provider: ContractProvider) {
    const { stack } = await provider.get("get_strategy_data", []);
    
    const strategyId = stack.readBigNumber()
    const withdrawPendingTime = stack.readBigNumber()
    const totalShares = stack.readBigNumber()
    const debtToken = stack.readBigNumber()
    const utonicManagerAddress = stack.readAddress()
    const adminAddress = stack.readAddress()
    const pendingAdminAddress = stack.readAddress()
    const tonReceiverAddress = stack.readAddress()
    return {
        strategyId,
        withdrawPendingTime,
        totalShares,
        debtToken,
        utonicManagerAddress,
        adminAddress,
        pendingAdminAddress,
        tonReceiverAddress,
    };
  }

  async getUserStrategyInfoAddress(provider: ContractProvider, userAddress: Address) {
    const { stack } = await provider.get("get_user_strategy_info_address", [
        {
          type: 'slice',
          cell: 
              beginCell()
                  .storeAddress(userAddress)
              .endCell()
      } as TupleItemSlice
    ]);
    return stack.readAddress();
  }
  async getOperatorStrategyShareAddress(provider: ContractProvider, operatorAddress: Address) {
    const { stack } = await provider.get("get_operator_strategy_share_address", [
        {
          type: 'slice',
          cell: 
              beginCell()
                  .storeAddress(operatorAddress)
              .endCell()
      } as TupleItemSlice
    ]);
    return stack.readAddress();
  }
  async getStrategyWithdrawAddress(provider: ContractProvider, withdrawId: bigint, userAddress: Address) {
    const { stack } = await provider.get("get_strategy_withdraw_address", [
        {
          type: 'int',
          value: withdrawId
        } as TupleItemInt,
        {
            type: 'slice',
            cell: 
                beginCell()
                    .storeAddress(userAddress)
                .endCell()
          } as TupleItemSlice,
    ]);
    return stack.readAddress();
  }
}