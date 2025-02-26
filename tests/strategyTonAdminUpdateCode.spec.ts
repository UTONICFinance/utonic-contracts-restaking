import * as fs from "fs";
import { Address, Cell } from "@ton/core";
import { printTransactionFees, SandboxContract, TreasuryContract } from "@ton/sandbox";

import { MyBlockchain } from "./lib/blockchain";
import '@ton/test-utils';
import UTonicManager from "../wrappers/stake/utonicManager/UtonicManager";
import UtonicManager from "../wrappers/stake/utonicManager/UtonicManager";
import UserStrategyInfo from "../wrappers/stake/strategy/userStrategyInfo/UserStrategyInfo";
import { USER_STRATEGY_INFO_STATUS_DELEGATE_DONE, USER_STRATEGY_INFO_STATUS_NO_DELEGATE, USER_STRATEGY_INFO_STATUS_PENDING_UPDATE_DELEGATE, USER_STRATEGY_INFO_STATUS_PENDING_UPDATE_UNDELEGATE } from "../wrappers/stake/strategy/userStrategyInfo/UserStrategyInfoStatus";
import OperatorRegister from "../wrappers/stake/utonicManager/operatorRegister/OperatorRegister";
import { OPERATOR_REGISTER_STATUS_BANED, OPERATOR_REGISTER_STATUS_NORMAL } from "../wrappers/stake/utonicManager/operatorRegister/OperatorRegisterStatus";
import OperatorStrategyShare from "../wrappers/stake/strategy/operatorStrategyShare/OperatorStrategyShare";
import { exitCode } from "process";
import { STAKE_ERR_INSUFFICIENT_BALANCE, STAKE_ERR_INSUFFICIENT_SHARES, STAKE_ERR_INSUFFICIENT_VALUE, STAKE_ERR_INSUFFICIENT_WITHDRAW_CAPACITY, STAKE_ERR_INVALID_STATUS, STAKE_ERR_UNAUTHORIZED, STAKE_ERR_WRONG_CALLER } from "../wrappers/stake/stakeErr";
import { UTONIC_MANAGER_OP_ADMIN_SWITCH_OPERATOR_STATUS } from "../wrappers/stake/utonicManager/utonicManagerOp";
import { STAKE_OP_ADMIN_ACCEPT_ADMIN, STAKE_OP_ADMIN_UPDATE_ADMIN, STAKE_OP_ADMIN_UPDATE_CODE, STAKE_OP_BURN, STAKE_OP_DELEGATE_ACK, STAKE_OP_UNDELEGATE_ACK, STAKE_OP_WITHDRAW } from "../wrappers/stake/stakeOp";
import StrategyWithdraw from "../wrappers/stake/strategy/strategyWithdraw/StrategyWithdraw";
import { WITHDRAW_ERR_FINISHED, WITHDRAW_ERR_TIME_NOT_EXPIRED } from "../wrappers/stake/strategy/strategyWithdraw/strategyWithdrawErr";
import StrategyTon from "../wrappers/stake/strategy/strategyTon/StrategyTon";
import TestMinter from "../wrappers/test/jetton/TestMinter";
import TestJettonWallet from "../wrappers/test/jetton/TestJettonWallet";
import { STRATEGY_ERR_CAPACITY_NOT_ENOUGH } from "../wrappers/stake/strategy/strategyErr";
import { STRATEGY_OP_ADMIN_DELEGATE_ACK, STRATEGY_OP_ADMIN_EXTRACT_TOKEN, STRATEGY_OP_ADMIN_UNDELEGATE_ACK, STRATEGY_OP_ADMIN_UPDATE_OPERATOR_SHARE } from "../wrappers/stake/strategy/strategyOp";
import TestUpdateCode from "../wrappers/stake/test/TestUpdate";
import TestUpdate from "../wrappers/stake/test/TestUpdate";

describe("ton stake tests", () => {
  let blockchain: MyBlockchain;
  let admin: SandboxContract<TreasuryContract>;
  let admin2: SandboxContract<TreasuryContract>;
  let tonReceiver: SandboxContract<TreasuryContract>;
  let user1: SandboxContract<TreasuryContract>;
  let user2: SandboxContract<TreasuryContract>;
  let userResponse1: SandboxContract<TreasuryContract>;
  let userResponse2: SandboxContract<TreasuryContract>;
  let operator: SandboxContract<TreasuryContract>;
  let operatorResponse: SandboxContract<TreasuryContract>;
  let strategyTonContract: SandboxContract<StrategyTon>;
  let utonicManagerContract: SandboxContract<UTonicManager>;
  let stakeTestUpdateCode: Cell;

  let startTime: number;

  const withdrawPendingTime = 3 * 24 * 60 * 60;

  beforeEach(async () =>  {

    blockchain = await MyBlockchain.create();
    startTime = Math.floor(new Date().getTime() / 1000);
    blockchain.setNowTime(startTime);
    admin = await blockchain.treasury("admin");
    admin2 = await blockchain.treasury("admin2");
    tonReceiver = await blockchain.treasury("tonReceiver");
    user1 = await blockchain.treasury("user1");
    user2 = await blockchain.treasury("user2");
    userResponse1 = await blockchain.treasury("userResponse1");
    userResponse2 = await blockchain.treasury("userResponse2");
    operator = await blockchain.treasury("operator");
    operatorResponse = await blockchain.treasury("operatorResponse");

    const strategyTonCode = Cell.fromBoc(fs.readFileSync("build/strategy_ton.cell"))[0]; 
    const utonicManagerCode = Cell.fromBoc(fs.readFileSync("build/utonic_manager.cell"))[0];
    const operatorRegisterCode = Cell.fromBoc(fs.readFileSync("build/operator_register.cell"))[0];
    const operatorStrategyShareCode = Cell.fromBoc(fs.readFileSync("build/operator_strategy_share.cell"))[0];
    const userStrategyInfoCode = Cell.fromBoc(fs.readFileSync("build/user_strategy_info.cell"))[0];
    const strategyWithdrawCode = Cell.fromBoc(fs.readFileSync("build/strategy_withdraw.cell"))[0];
    stakeTestUpdateCode = Cell.fromBoc(fs.readFileSync("build/stake_test_update_code.cell"))[0];

    const utonicManager = UtonicManager.createForDeploy(
        utonicManagerCode,
        UtonicManager.initData(
            admin.address,
            operatorRegisterCode
        )
    )

    utonicManagerContract = blockchain.openContract(utonicManager)
    await utonicManagerContract.sendDeploy(admin.getSender(), "0.1");

    const strategyTon = StrategyTon.createForDeploy(
        strategyTonCode,
        StrategyTon.initData(
            2, withdrawPendingTime, utonicManagerContract.address,
            tonReceiver.address, admin.address,
            userStrategyInfoCode, operatorStrategyShareCode, strategyWithdrawCode
        ),
    )

    strategyTonContract = blockchain.openContract(strategyTon)
    await strategyTonContract.sendDeploy(admin.getSender(), "0.1")

  }),

  it("not admin try to update code", async () => {
    
    // user1 try to update pending admin
    let userUpdate1 = await strategyTonContract.sendAdminUpdateCode(
        user1.getSender(), 1, stakeTestUpdateCode, "0.1"
    )
    expect(userUpdate1.transactions).toHaveTransaction({
        to: strategyTonContract.address,
        exitCode: STAKE_ERR_UNAUTHORIZED,
        op: STAKE_OP_ADMIN_UPDATE_CODE
    })
    // nothing changed
    let strategyTonData = await strategyTonContract.getStrategyData()
    expect(strategyTonData.adminAddress.toString()).toBe(admin.address.toString())
    expect(strategyTonData.pendingAdminAddress.toString()).toBe(admin.address.toString())
    expect(strategyTonData.debtToken).toBe(0n)
    expect(strategyTonData.strategyId).toBe(2n)
    expect(strategyTonData.tonReceiverAddress.toString()).toBe(tonReceiver.address.toString())
    expect(strategyTonData.totalShares).toBe(0n)
    expect(strategyTonData.utonicManagerAddress.toString()).toBe(utonicManagerContract.address.toString())
    expect(strategyTonData.withdrawPendingTime).toBe(BigInt(withdrawPendingTime))

    const testUpdate = TestUpdate.createForDeploy(strategyTonContract.address)
    const testUpdateContract = blockchain.openContract(testUpdate)
    let sendOp1 = await testUpdateContract.sendOp1(user1.getSender(), 1, user1.address, "0.1");
    // send op1 failed
    expect(sendOp1.transactions).toHaveTransaction({
        op: 1, 
        to: strategyTonContract.address,
        exitCode: 0xffff
    })
  });


  it("admin update code", async () => {
    
    let adminUpdate = await strategyTonContract.sendAdminUpdateCode(
        admin.getSender(), 1, stakeTestUpdateCode, "0.1"
    )
    const testUpdate = TestUpdate.createForDeploy(strategyTonContract.address)
    const testUpdateContract = blockchain.openContract(testUpdate)
    let sendOp1 = await testUpdateContract.sendOp1(user1.getSender(), 1, user1.address, "0.1");
    // send op1 success
    expect(sendOp1.transactions).toHaveTransaction({
        op: 11, 
        to: user1.address,
    })
  });

});