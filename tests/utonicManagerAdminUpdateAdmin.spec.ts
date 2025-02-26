import * as fs from "fs";
import { Cell } from "@ton/core";
import { printTransactionFees, SandboxContract, TreasuryContract } from "@ton/sandbox";

import { MyBlockchain } from "./lib/blockchain";
import '@ton/test-utils';
import StrategyTon from "../wrappers/stake/strategy/strategyTon/StrategyTon";
import UTonicManager from "../wrappers/stake/utonicManager/UtonicManager";
import UtonicManager from "../wrappers/stake/utonicManager/UtonicManager";
import UserStrategyInfo from "../wrappers/stake/strategy/userStrategyInfo/UserStrategyInfo";
import { USER_STRATEGY_INFO_STATUS_DELEGATE_DONE, USER_STRATEGY_INFO_STATUS_NO_DELEGATE } from "../wrappers/stake/strategy/userStrategyInfo/UserStrategyInfoStatus";
import OperatorRegister from "../wrappers/stake/utonicManager/operatorRegister/OperatorRegister";
import { OPERATOR_REGISTER_STATUS_BANED, OPERATOR_REGISTER_STATUS_NORMAL } from "../wrappers/stake/utonicManager/operatorRegister/OperatorRegisterStatus";
import OperatorStrategyShare from "../wrappers/stake/strategy/operatorStrategyShare/OperatorStrategyShare";
import { exitCode } from "process";
import { STAKE_ERR_INSUFFICIENT_BALANCE, STAKE_ERR_INSUFFICIENT_SHARES, STAKE_ERR_INSUFFICIENT_VALUE, STAKE_ERR_INVALID_STATUS, STAKE_ERR_UNAUTHORIZED, STAKE_ERR_WRONG_CALLER } from "../wrappers/stake/stakeErr";
import { UTONIC_MANAGER_OP_ADMIN_SWITCH_OPERATOR_STATUS } from "../wrappers/stake/utonicManager/utonicManagerOp";
import { STAKE_OP_ADMIN_ACCEPT_ADMIN, STAKE_OP_ADMIN_UPDATE_ADMIN, STAKE_OP_BURN, STAKE_OP_WITHDRAW } from "../wrappers/stake/stakeOp";
import StrategyWithdraw from "../wrappers/stake/strategy/strategyWithdraw/StrategyWithdraw";
import { WITHDRAW_ERR_FINISHED, WITHDRAW_ERR_TIME_NOT_EXPIRED } from "../wrappers/stake/strategy/strategyWithdraw/strategyWithdrawErr";
import { STRATEGY_OP_ADMIN_EXTRACT_TOKEN } from "../wrappers/stake/strategy/strategyOp";

describe("utonic manager tests", () => {
  let blockchain: MyBlockchain;
  let admin: SandboxContract<TreasuryContract>;
  let admin2: SandboxContract<TreasuryContract>;
  let user1: SandboxContract<TreasuryContract>;
  let user2: SandboxContract<TreasuryContract>;
  let userResponse1: SandboxContract<TreasuryContract>;
  let userResponse2: SandboxContract<TreasuryContract>;
  let operator: SandboxContract<TreasuryContract>;
  let operatorResponse: SandboxContract<TreasuryContract>;
  let utonicManagerContract: SandboxContract<UTonicManager>;

  let startTime: number;

  const withdrawPendingTime = 3 * 24 * 60 * 60;

  beforeEach(async () =>  {

    blockchain = await MyBlockchain.create();
    startTime = Math.floor(new Date().getTime() / 1000);
    blockchain.setNowTime(startTime);
    admin = await blockchain.treasury("admin");
    admin2 = await blockchain.treasury("admin2");
    user1 = await blockchain.treasury("user1");
    user2 = await blockchain.treasury("user2");
    userResponse1 = await blockchain.treasury("userResponse1");
    userResponse2 = await blockchain.treasury("userResponse2");
    operator = await blockchain.treasury("operator");
    operatorResponse = await blockchain.treasury("operatorResponse");

    const utonicManagerCode = Cell.fromBoc(fs.readFileSync("build/utonic_manager.cell"))[0];
    const operatorRegisterCode = Cell.fromBoc(fs.readFileSync("build/operator_register.cell"))[0];

    const utonicManager = UtonicManager.createForDeploy(
        utonicManagerCode,
        UtonicManager.initData(
            admin.address,
            operatorRegisterCode
        )
    )

    utonicManagerContract = blockchain.openContract(utonicManager)
    await utonicManagerContract.sendDeploy(admin.getSender(), "0.1");
   
  }),

  it("not admin try to update admin", async () => {
    
    // user1 try to update pending admin
    let userUpdate1 = await utonicManagerContract.sendAdminUpdateAdmin(
        user1.getSender(), 1, user1.address, "0.1"
    )
    expect(userUpdate1.transactions).toHaveTransaction({
        to: utonicManagerContract.address,
        exitCode: STAKE_ERR_UNAUTHORIZED,
        op: STAKE_OP_ADMIN_UPDATE_ADMIN
    })
    // nothing changed
    let utonicManagerData = await utonicManagerContract.getUtonicManagerData()
    expect(utonicManagerData.adminAddress.toString()).toBe(admin.address.toString())
    expect(utonicManagerData.pendingAdminAddress.toString()).toBe(admin.address.toString())
    // user1 try to accept admin
    let userAccept1 = await utonicManagerContract.sendAdminAcceptAdmin(
      user1.getSender(), 1, "0.1"
    )
    expect(userAccept1.transactions).toHaveTransaction({
      to: utonicManagerContract.address,
      exitCode: STAKE_ERR_WRONG_CALLER,
      op: STAKE_OP_ADMIN_ACCEPT_ADMIN
    })
    // nothing changed
    utonicManagerData = await utonicManagerContract.getUtonicManagerData()
    expect(utonicManagerData.adminAddress.toString()).toBe(admin.address.toString())
    expect(utonicManagerData.pendingAdminAddress.toString()).toBe(admin.address.toString())

  });


  it(" admin update admin", async () => {    
    let adminUpdate = await utonicManagerContract.sendAdminUpdateAdmin(
        admin.getSender(), 1, admin2.address, "0.1"
    )
    let utonicManagerData = await utonicManagerContract.getUtonicManagerData()
    expect(utonicManagerData.adminAddress.toString()).toBe(admin.address.toString())
    expect(utonicManagerData.pendingAdminAddress.toString()).toBe(admin2.address.toString())
    // user1 try to accept admin
    let userAccept1 = await utonicManagerContract.sendAdminAcceptAdmin(
      user1.getSender(), 1, "0.1"
    )
    expect(userAccept1.transactions).toHaveTransaction({
      to: utonicManagerContract.address,
      exitCode: STAKE_ERR_WRONG_CALLER,
      op: STAKE_OP_ADMIN_ACCEPT_ADMIN
    })
    utonicManagerData = await utonicManagerContract.getUtonicManagerData()
    expect(utonicManagerData.adminAddress.toString()).toBe(admin.address.toString())
    expect(utonicManagerData.pendingAdminAddress.toString()).toBe(admin2.address.toString())
    let adminAccept2 = await utonicManagerContract.sendAdminAcceptAdmin(
        admin2.getSender(), 1, "0.1"
    )
    utonicManagerData = await utonicManagerContract.getUtonicManagerData()
    expect(utonicManagerData.adminAddress.toString()).toBe(admin2.address.toString())
    expect(utonicManagerData.pendingAdminAddress.toString()).toBe(admin2.address.toString())
  
  });

});