import { Contract, ContractProvider, Sender, Address, Cell, contractAddress, beginCell, Slice, TupleItemSlice, TupleItemInt, Dictionary } from "@ton/core";
import { UTONIC_MANAGER_OP_ADMIN_CLAIM_OPT_SHARE, UTONIC_MANAGER_OP_ADMIN_SWITCH_OPERATOR_STATUS, UTONIC_MANAGER_OP_REGISTER } from "./utonicManagerOp";
import { STAKE_OP_ADMIN_ACCEPT_ADMIN, STAKE_OP_ADMIN_UPDATE_ADMIN, STAKE_OP_ADMIN_UPDATE_CODE, STAKE_OP_QUERY_ACK } from "../stakeOp";

export default class UTonicManager implements Contract {

  static initData(
    adminAddress: Address,
    operatorRegisterCode: Cell,
  ): Cell {
    return beginCell()
      .storeAddress(adminAddress)
      .storeAddress(adminAddress)
      .storeRef(operatorRegisterCode)
      .endCell();
  }

  static createForDeploy(code: Cell, data: Cell): UTonicManager {
    const workchain = 0; // deploy to workchain 0
    const address = contractAddress(workchain, { code, data });
    return new UTonicManager(address, { code, data });
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

  async sendRegister(provider: ContractProvider, via: Sender, queryId: number, responseAddress: Address, value: string) {
    const messageBody = beginCell()
      .storeUint(UTONIC_MANAGER_OP_REGISTER, 32) // op 
      .storeUint(queryId, 64) // query id
      .storeAddress(responseAddress)
      .endCell();
    await provider.internal(via, {
      value,
      body: messageBody
    });
  }

  async sendQueryAck(provider: ContractProvider, via: Sender, queryId: number, operatorStatus: number, operatorAddress: Address, value: string) {
    const messageBody = beginCell()
      .storeUint(STAKE_OP_QUERY_ACK, 32) // op 
      .storeUint(queryId, 64) // query id
      .storeUint(operatorStatus, 2)
      .storeAddress(operatorAddress)
      .endCell();
    await provider.internal(via, {
      value,
      body: messageBody
    });
  }

  async sendAdminSwitchOperatorStatus(provider: ContractProvider, via: Sender, queryId: number, isBaned: boolean, operatorRegisterAddress: Address, responseAddress: Address, value: string) {
    const messageBody = beginCell()
      .storeUint(UTONIC_MANAGER_OP_ADMIN_SWITCH_OPERATOR_STATUS, 32) // op 
      .storeUint(queryId, 64) // query id
      .storeUint(isBaned? 1 : 0, 1)
      .storeAddress(operatorRegisterAddress)
      .storeAddress(responseAddress)
      .endCell();
    await provider.internal(via, {
      value,
      body: messageBody
    });
  }

  async sendAdminClaimOperatorShare(provider: ContractProvider, via: Sender, queryId: number, operatorAddress: Address, strategyAddress: Address, recipientAddress: Address, value: string) {
    const messageBody = beginCell()
      .storeUint(UTONIC_MANAGER_OP_ADMIN_CLAIM_OPT_SHARE, 32) // op 
      .storeUint(queryId, 64) // query id
      .storeAddress(operatorAddress)
      .storeAddress(strategyAddress)
      .storeAddress(recipientAddress)
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

  async getUtonicManagerData(provider: ContractProvider) {
    const { stack } = await provider.get("get_utonic_manager_data", []);
    const adminAddress = stack.readAddress();
    const pendingAdminAddress = stack.readAddress();
    const operatorRegisterCode = stack.readCell();
    return {
      adminAddress,
      pendingAdminAddress,
      operatorRegisterCode
    };
  }

  async getOperatorRegisterAddress(provider: ContractProvider, operatorAddress: Address) {
    const { stack } = await provider.get("get_operator_register_address", [
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
}