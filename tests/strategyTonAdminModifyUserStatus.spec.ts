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
import { STAKE_OP_BURN, STAKE_OP_DELEGATE_ACK, STAKE_OP_UNDELEGATE_ACK, STAKE_OP_WITHDRAW } from "../wrappers/stake/stakeOp";
import StrategyWithdraw from "../wrappers/stake/strategy/strategyWithdraw/StrategyWithdraw";
import { WITHDRAW_ERR_FINISHED, WITHDRAW_ERR_TIME_NOT_EXPIRED } from "../wrappers/stake/strategy/strategyWithdraw/strategyWithdrawErr";
import StrategyTon from "../wrappers/stake/strategy/strategyTon/StrategyTon";
import TestMinter from "../wrappers/test/jetton/TestMinter";
import TestJettonWallet from "../wrappers/test/jetton/TestJettonWallet";
import { STRATEGY_ERR_CAPACITY_NOT_ENOUGH } from "../wrappers/stake/strategy/strategyErr";
import { STRATEGY_OP_ADMIN_DELEGATE_ACK, STRATEGY_OP_ADMIN_EXTRACT_TOKEN, STRATEGY_OP_ADMIN_UNDELEGATE_ACK } from "../wrappers/stake/strategy/strategyOp";

describe("ton stake tests", () => {
  let blockchain: MyBlockchain;
  let admin: SandboxContract<TreasuryContract>;
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
    const testJettonMinterCode = Cell.fromBoc(fs.readFileSync("build/test_jetton_minter.cell"))[0];
    const testJettonWalletCode = Cell.fromBoc(fs.readFileSync("build/test_jetton_wallet.cell"))[0];
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

    const jettonMinter = TestMinter.createForDeploy(
        testJettonMinterCode,
        TestMinter.initData(
            admin.address,
            "test minter",
            testJettonWalletCode,
        )
    )

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

  it("cancel pending delegate", async () => {
    
    // user1 init
    let userInitRes1 = await strategyTonContract.sendInitUserInfo(
        user1.getSender(), 1, userResponse1.address, "0.1"
    )
    let userInfoAddress1 = await strategyTonContract.getUserStrategyInfoAddress(user1.address)
    let userInfo1 = UserStrategyInfo.createForDeploy(userInfoAddress1)
    let userInfoContract1 = blockchain.openContract(userInfo1)
    let userInfoData1 = await userInfoContract1.getUserStrategyInfoData()
    expect(userInfoData1.withdrawCnt).toBe(0n);
    expect(userInfoData1.shares).toBe(0n);
    expect(userInfoData1.status).toBe(BigInt(USER_STRATEGY_INFO_STATUS_NO_DELEGATE));

    // operator register
    let operatorRegisterRes = await utonicManagerContract.sendRegister(
        operator.getSender(), 2, operatorResponse.address, "0.1"
    )
    // printTransactionFees(operatorRegisterRes.transactions)
    let operatorRegisterAddress = await utonicManagerContract.getOperatorRegisterAddress(operator.address)
    let operatorRegister = OperatorRegister.createForDeploy(operatorRegisterAddress)
    let operatorRegisterContract = blockchain.openContract(operatorRegister)
    let operatorRegisterData = await operatorRegisterContract.getOperatorRegisterData()
    expect(operatorRegisterData.operatorAddress.toString()).toBe(operator.address.toString())
    expect(operatorRegisterData.utonicManagerAddress.toString()).toBe(utonicManagerContract.address.toString())
    expect(operatorRegisterData.status).toBe(BigInt(OPERATOR_REGISTER_STATUS_NORMAL))
    
    // update utonic manager code
    const adminUpdateUtonicCode = await utonicManagerContract.sendAdminUpdateCode(admin.getSender(), 1, stakeTestUpdateCode, "0.1");
    // printTransactionFees(adminUpdateUtonicCode.transactions)
    // user1 delegate
    let userDelegateRes1 = await userInfoContract1.sendDelegate(
        user1.getSender(), 1, operator.address, userResponse1.address, "0.5"
    );
    // printTransactionFees(userDelegateRes1.transactions)
    userInfoData1 = await userInfoContract1.getUserStrategyInfoData()
    expect(userInfoData1.withdrawCnt).toBe(0n);
    expect(userInfoData1.shares).toBe(0n);
    expect(userInfoData1.status).toBe(BigInt(USER_STRATEGY_INFO_STATUS_PENDING_UPDATE_DELEGATE));
    // user2 try to cancel pending of user1
    let userCancel2 = await strategyTonContract.sendAdminCancelUserPending(
        user2.getSender(), 1, userInfoContract1.address, "0.1"
    )
    expect(userCancel2.transactions).toHaveTransaction(
        {
            to: strategyTonContract.address,
            exitCode: STAKE_ERR_UNAUTHORIZED
        }
    )
    // printTransactionFees(userCancel2.transactions)
    userInfoData1 = await userInfoContract1.getUserStrategyInfoData()
    expect(userInfoData1.withdrawCnt).toBe(0n);
    expect(userInfoData1.shares).toBe(0n);
    expect(userInfoData1.status).toBe(BigInt(USER_STRATEGY_INFO_STATUS_PENDING_UPDATE_DELEGATE));
    // admin cancel pending
    let adminCancel = await strategyTonContract.sendAdminCancelUserPending(
        admin.getSender(), 1, userInfoContract1.address, "0.1"
    )
    userInfoData1 = await userInfoContract1.getUserStrategyInfoData()
    expect(userInfoData1.withdrawCnt).toBe(0n);
    expect(userInfoData1.shares).toBe(0n);
    expect(userInfoData1.status).toBe(BigInt(USER_STRATEGY_INFO_STATUS_NO_DELEGATE));
  });

  it("admin delegate ack", async () => {
    
    // user1 init
    let userInitRes1 = await strategyTonContract.sendInitUserInfo(
        user1.getSender(), 1, userResponse1.address, "0.1"
    )
    let userInfoAddress1 = await strategyTonContract.getUserStrategyInfoAddress(user1.address)
    let userInfo1 = UserStrategyInfo.createForDeploy(userInfoAddress1)
    let userInfoContract1 = blockchain.openContract(userInfo1)
    let userInfoData1 = await userInfoContract1.getUserStrategyInfoData()
    expect(userInfoData1.withdrawCnt).toBe(0n);
    expect(userInfoData1.shares).toBe(0n);
    expect(userInfoData1.status).toBe(BigInt(USER_STRATEGY_INFO_STATUS_NO_DELEGATE));

    // operator register
    let operatorRegisterRes = await utonicManagerContract.sendRegister(
        operator.getSender(), 2, operatorResponse.address, "0.1"
    )
    // printTransactionFees(operatorRegisterRes.transactions)
    let operatorRegisterAddress = await utonicManagerContract.getOperatorRegisterAddress(operator.address)
    let operatorRegister = OperatorRegister.createForDeploy(operatorRegisterAddress)
    let operatorRegisterContract = blockchain.openContract(operatorRegister)
    let operatorRegisterData = await operatorRegisterContract.getOperatorRegisterData()
    expect(operatorRegisterData.operatorAddress.toString()).toBe(operator.address.toString())
    expect(operatorRegisterData.utonicManagerAddress.toString()).toBe(utonicManagerContract.address.toString())
    expect(operatorRegisterData.status).toBe(BigInt(OPERATOR_REGISTER_STATUS_NORMAL))
    
    // update utonic manager code
    const adminUpdateUtonicCode = await utonicManagerContract.sendAdminUpdateCode(admin.getSender(), 1, stakeTestUpdateCode, "0.1");
    // user1 delegate
    let userDelegateRes1 = await userInfoContract1.sendDelegate(
        user1.getSender(), 1, operator.address, userResponse1.address, "0.5"
    );
    // printTransactionFees(userDelegateRes1.transactions)
    userInfoData1 = await userInfoContract1.getUserStrategyInfoData()
    expect(userInfoData1.withdrawCnt).toBe(0n);
    expect(userInfoData1.shares).toBe(0n);
    expect(userInfoData1.status).toBe(BigInt(USER_STRATEGY_INFO_STATUS_PENDING_UPDATE_DELEGATE));
    // user2 try to delegate ack user1
    let userDelegateAck2 = await strategyTonContract.sendAdminDelegateAck(
        user2.getSender(), 1, userInfoContract1.address, userResponse2.address, "0.1"
    )
    expect(userDelegateAck2.transactions).toHaveTransaction(
        {
            op: STRATEGY_OP_ADMIN_DELEGATE_ACK,
            to: strategyTonContract.address,
            exitCode: STAKE_ERR_UNAUTHORIZED
        }
    )
    // printTransactionFees(userCancel2.transactions)
    userInfoData1 = await userInfoContract1.getUserStrategyInfoData()
    expect(userInfoData1.withdrawCnt).toBe(0n);
    expect(userInfoData1.shares).toBe(0n);
    expect(userInfoData1.status).toBe(BigInt(USER_STRATEGY_INFO_STATUS_PENDING_UPDATE_DELEGATE));
    // admin try to undelegate ack user1
    let adminUndelegateAck = await strategyTonContract.sendAdminUndelegateAck(
        admin.getSender(), 1, userInfoContract1.address, userResponse2.address, "0.1"
    )
    expect(adminUndelegateAck.transactions).toHaveTransaction(
        {
            op: STAKE_OP_UNDELEGATE_ACK,
            to: userInfoContract1.address,
            exitCode: STAKE_ERR_INVALID_STATUS
        }
    ) 
    // admin delgate ack user1
    let adminDelegateAck = await strategyTonContract.sendAdminDelegateAck(
        admin.getSender(), 1, userInfoContract1.address, userResponse2.address, "0.1"
    )
    userInfoData1 = await userInfoContract1.getUserStrategyInfoData()
    expect(userInfoData1.withdrawCnt).toBe(0n);
    expect(userInfoData1.shares).toBe(0n);
    expect(userInfoData1.status).toBe(BigInt(USER_STRATEGY_INFO_STATUS_DELEGATE_DONE));
  });

  it("admin undelegate ack", async () => {
    
    // user1 init
    let userInitRes1 = await strategyTonContract.sendInitUserInfo(
        user1.getSender(), 1, userResponse1.address, "0.1"
    )
    let userInfoAddress1 = await strategyTonContract.getUserStrategyInfoAddress(user1.address)
    let userInfo1 = UserStrategyInfo.createForDeploy(userInfoAddress1)
    let userInfoContract1 = blockchain.openContract(userInfo1)
    let userInfoData1 = await userInfoContract1.getUserStrategyInfoData()
    expect(userInfoData1.withdrawCnt).toBe(0n);
    expect(userInfoData1.shares).toBe(0n);
    expect(userInfoData1.status).toBe(BigInt(USER_STRATEGY_INFO_STATUS_NO_DELEGATE));

    // operator register
    let operatorRegisterRes = await utonicManagerContract.sendRegister(
        operator.getSender(), 2, operatorResponse.address, "0.1"
    )
    // printTransactionFees(operatorRegisterRes.transactions)
    let operatorRegisterAddress = await utonicManagerContract.getOperatorRegisterAddress(operator.address)
    let operatorRegister = OperatorRegister.createForDeploy(operatorRegisterAddress)
    let operatorRegisterContract = blockchain.openContract(operatorRegister)
    let operatorRegisterData = await operatorRegisterContract.getOperatorRegisterData()
    expect(operatorRegisterData.operatorAddress.toString()).toBe(operator.address.toString())
    expect(operatorRegisterData.utonicManagerAddress.toString()).toBe(utonicManagerContract.address.toString())
    expect(operatorRegisterData.status).toBe(BigInt(OPERATOR_REGISTER_STATUS_NORMAL))
    
    // user1 delegate
    let userDelegateRes1 = await userInfoContract1.sendDelegate(
        user1.getSender(), 1, operator.address, userResponse1.address, "0.5"
    );
    // printTransactionFees(userDelegateRes1.transactions)
    userInfoData1 = await userInfoContract1.getUserStrategyInfoData()
    expect(userInfoData1.withdrawCnt).toBe(0n);
    expect(userInfoData1.shares).toBe(0n);
    expect(userInfoData1.status).toBe(BigInt(USER_STRATEGY_INFO_STATUS_DELEGATE_DONE));

    // update utonic manager code
    const adminUpdateUtonicCode = await utonicManagerContract.sendAdminUpdateCode(admin.getSender(), 1, stakeTestUpdateCode, "0.1");

    // user1 undelegate
    let userUndelegateRes1 = await userInfoContract1.sendUndelegate(
        user1.getSender(), 1, userResponse1.address, "0.5"
    );
    // printTransactionFees(userDelegateRes1.transactions)
    userInfoData1 = await userInfoContract1.getUserStrategyInfoData()
    expect(userInfoData1.withdrawCnt).toBe(0n);
    expect(userInfoData1.shares).toBe(0n);
    expect(userInfoData1.status).toBe(BigInt(USER_STRATEGY_INFO_STATUS_PENDING_UPDATE_UNDELEGATE));

    // user2 try to undelegate ack user1
    let userUndelegateAck2 = await strategyTonContract.sendAdminUndelegateAck(
        user2.getSender(), 1, userInfoContract1.address, userResponse2.address, "0.1"
    )
    expect(userUndelegateAck2.transactions).toHaveTransaction(
        {
            op: STRATEGY_OP_ADMIN_UNDELEGATE_ACK,
            to: strategyTonContract.address,
            exitCode: STAKE_ERR_UNAUTHORIZED
        }
    )
    // printTransactionFees(userCancel2.transactions)
    userInfoData1 = await userInfoContract1.getUserStrategyInfoData()
    expect(userInfoData1.withdrawCnt).toBe(0n);
    expect(userInfoData1.shares).toBe(0n);
    expect(userInfoData1.status).toBe(BigInt(USER_STRATEGY_INFO_STATUS_PENDING_UPDATE_UNDELEGATE));
    // admin try to delegate ack user1
    let adminDelegateAck = await strategyTonContract.sendAdminDelegateAck(
        admin.getSender(), 1, userInfoContract1.address, userResponse2.address, "0.1"
    )
    expect(adminDelegateAck.transactions).toHaveTransaction(
        {
            op: STAKE_OP_DELEGATE_ACK,
            to: userInfoContract1.address,
            exitCode: STAKE_ERR_INVALID_STATUS
        }
    ) 
    // admin undelgate ack user1
    let adminUndelegateAck = await strategyTonContract.sendAdminUndelegateAck(
        admin.getSender(), 1, userInfoContract1.address, admin.address, "0.1"
    )
    userInfoData1 = await userInfoContract1.getUserStrategyInfoData()
    expect(userInfoData1.withdrawCnt).toBe(0n);
    expect(userInfoData1.shares).toBe(0n);
    expect(userInfoData1.status).toBe(BigInt(USER_STRATEGY_INFO_STATUS_NO_DELEGATE));
  });
});