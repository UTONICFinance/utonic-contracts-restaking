import { Contract, ContractProvider, Sender, Address, Cell, beginCell } from "@ton/core";
import { STAKE_OP_INIT } from "../../stakeOp";
import { UTONIC_MANAGER_OP_ADMIN_SWITCH_OPERATOR_STATUS } from "../utonicManagerOp";

export default class OperatorRegister implements Contract {

  constructor(readonly address: Address, readonly init?: { code: Cell, data: Cell }) {}

  static createForDeploy(address: Address): OperatorRegister {
    return new OperatorRegister(address);
  }

  
  async sendInit(provider: ContractProvider, via: Sender, queryId: number, responseAddress: Address, value: string) {
    const messageBody = beginCell()
      .storeUint(STAKE_OP_INIT, 32) // op 
      .storeUint(queryId, 64) // query id
      .storeAddress(responseAddress)
      .endCell();
    await provider.internal(via, {
      value,
      body: messageBody
    });
  }

  async sendSwitchOperatorStatus(provider: ContractProvider, via: Sender, queryId: number, isBaned: boolean, responseAddress: Address, value: string) {
    const messageBody = beginCell()
      .storeUint(UTONIC_MANAGER_OP_ADMIN_SWITCH_OPERATOR_STATUS, 32) // op 
      .storeUint(queryId, 64) // query id
      .storeUint(isBaned ? 1 : 0, 1)
      .storeAddress(responseAddress)
      .endCell();
    await provider.internal(via, {
      value,
      body: messageBody
    });
  }

  async getOperatorRegisterData(provider: ContractProvider) {
    const { stack } = await provider.get("get_operator_register_data", []);
    
    const status = stack.readBigNumber();
    const operatorAddress = stack.readAddress();
    const utonicManagerAddress = stack.readAddress();
    return {
        status,
        operatorAddress,
        utonicManagerAddress
    };
  }

}