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
import StrategyJetton from "../wrappers/stake/strategy/strategyJetton/StrategyJetton";
import TestMinter from "../wrappers/test/jetton/TestMinter";
import TestJettonWallet from "../wrappers/test/jetton/TestJettonWallet";
import { STRATEGY_ERR_CAPACITY_NOT_ENOUGH } from "../wrappers/stake/strategy/strategyErr";
import { STRATEGY_OP_ADMIN_DELEGATE_ACK, STRATEGY_OP_ADMIN_EXTRACT_TOKEN, STRATEGY_OP_ADMIN_UNDELEGATE_ACK, STRATEGY_OP_ADMIN_UPDATE_CAPACITY, STRATEGY_OP_ADMIN_UPDATE_OPERATOR_SHARE, STRATEGY_OP_ADMIN_UPDATE_TOKEN_RECEIVER, STRATEGY_OP_ADMIN_UPDATE_UTONIC_MANAGER, STRATEGY_OP_ADMIN_UPDATE_WITHDRAW_PENDING_TIME } from "../wrappers/stake/strategy/strategyOp";
import TestUpdateCode from "../wrappers/stake/test/TestUpdate";
import TestUpdate from "../wrappers/stake/test/TestUpdate";

describe("ton stake tests", () => {
  let blockchain: MyBlockchain;
  let admin: SandboxContract<TreasuryContract>;
  let newJettonReceiver: SandboxContract<TreasuryContract>;
  let jettonReceiver: SandboxContract<TreasuryContract>;
  let user1: SandboxContract<TreasuryContract>;
  let user2: SandboxContract<TreasuryContract>;
  let userResponse1: SandboxContract<TreasuryContract>;
  let userResponse2: SandboxContract<TreasuryContract>;
  let operator: SandboxContract<TreasuryContract>;
  let operatorResponse: SandboxContract<TreasuryContract>;
  let strategyJettonContract: SandboxContract<StrategyJetton>;
  let utonicManagerContract: SandboxContract<UTonicManager>;
  let stakeTestUpdateCode: Cell;

  let startTime: number;

  const withdrawPendingTime = 3 * 24 * 60 * 60;
  const newWithdrawPendingTime = 7 * 24 * 60 * 60;
  const fakeWithdrawPendingTime = 60 * 60;

  const capacity = BigInt(3e9)
  const fakeCapacity = BigInt(6e9)
  const newCapacity = BigInt(1e9)

  beforeEach(async () =>  {

    blockchain = await MyBlockchain.create();
    startTime = Math.floor(new Date().getTime() / 1000);
    blockchain.setNowTime(startTime);
    admin = await blockchain.treasury("admin");
    newJettonReceiver = await blockchain.treasury("newJettonReceiver");
    jettonReceiver = await blockchain.treasury("jettonReceiver");
    user1 = await blockchain.treasury("user1");
    user2 = await blockchain.treasury("user2");
    userResponse1 = await blockchain.treasury("userResponse1");
    userResponse2 = await blockchain.treasury("userResponse2");
    operator = await blockchain.treasury("operator");
    operatorResponse = await blockchain.treasury("operatorResponse");

    const strategyJettonCode = Cell.fromBoc(fs.readFileSync("build/strategy_jetton.cell"))[0]; 
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

    const strategyJetton = StrategyJetton.createForDeploy(
        strategyJettonCode,
        StrategyJetton.initData(
            2, withdrawPendingTime, capacity, utonicManagerContract.address,
            admin.address,
            userStrategyInfoCode, operatorStrategyShareCode, strategyWithdrawCode
        ),
    )

    strategyJettonContract = blockchain.openContract(strategyJetton)
    await strategyJettonContract.sendDeploy(admin.getSender(), "0.1")

  }),

  it("not admin try to update utonic manager", async () => {
    
    // user1 try to update pending admin
    let userUpdate1 = await strategyJettonContract.sendAdminUpdateCapacity(
        user1.getSender(), 1, fakeCapacity, "0.1"
    )
    expect(userUpdate1.transactions).toHaveTransaction({
        to: strategyJettonContract.address,
        exitCode: STAKE_ERR_UNAUTHORIZED,
        op: STRATEGY_OP_ADMIN_UPDATE_CAPACITY
    })
    // nothing changed
    let strategyJettonData = await strategyJettonContract.getStrategyData()
    expect(strategyJettonData.adminAddress.toString()).toBe(admin.address.toString())
    expect(strategyJettonData.pendingAdminAddress.toString()).toBe(admin.address.toString())
    expect(strategyJettonData.debtToken).toBe(0n)
    expect(strategyJettonData.capacity).toBe(capacity)
    expect(strategyJettonData.strategyId).toBe(2n)
    expect(strategyJettonData.totalShares).toBe(0n)
    expect(strategyJettonData.utonicManagerAddress.toString()).toBe(utonicManagerContract.address.toString())
    expect(strategyJettonData.withdrawPendingTime).toBe(BigInt(withdrawPendingTime))

  });


  it("admin update code", async () => {
    
    let adminUpdate = await strategyJettonContract.sendAdminUpdateCapacity(
        admin.getSender(), 1, newCapacity, "0.1"
    )
    let strategyJettonData = await strategyJettonContract.getStrategyData()
    expect(strategyJettonData.adminAddress.toString()).toBe(admin.address.toString())
    expect(strategyJettonData.pendingAdminAddress.toString()).toBe(admin.address.toString())
    expect(strategyJettonData.debtToken).toBe(0n)
    expect(strategyJettonData.capacity).toBe(newCapacity)
    expect(strategyJettonData.strategyId).toBe(2n)
    expect(strategyJettonData.totalShares).toBe(0n)
    expect(strategyJettonData.utonicManagerAddress.toString()).toBe(utonicManagerContract.address.toString())
    expect(strategyJettonData.withdrawPendingTime).toBe(BigInt(withdrawPendingTime))

  });

});