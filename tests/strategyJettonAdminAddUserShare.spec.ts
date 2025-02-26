import * as fs from "fs";
import { Address, Cell } from "@ton/core";
import { printTransactionFees, SandboxContract, TreasuryContract } from "@ton/sandbox";

import { MyBlockchain } from "./lib/blockchain";
import '@ton/test-utils';
import UTonicManager from "../wrappers/stake/utonicManager/UtonicManager";
import UtonicManager from "../wrappers/stake/utonicManager/UtonicManager";
import UserStrategyInfo from "../wrappers/stake/strategy/userStrategyInfo/UserStrategyInfo";
import { USER_STRATEGY_INFO_STATUS_DELEGATE_DONE, USER_STRATEGY_INFO_STATUS_NO_DELEGATE } from "../wrappers/stake/strategy/userStrategyInfo/UserStrategyInfoStatus";
import OperatorRegister from "../wrappers/stake/utonicManager/operatorRegister/OperatorRegister";
import { OPERATOR_REGISTER_STATUS_BANED, OPERATOR_REGISTER_STATUS_NORMAL } from "../wrappers/stake/utonicManager/operatorRegister/OperatorRegisterStatus";
import OperatorStrategyShare from "../wrappers/stake/strategy/operatorStrategyShare/OperatorStrategyShare";
import { exitCode } from "process";
import { STAKE_ERR_INSUFFICIENT_BALANCE, STAKE_ERR_INSUFFICIENT_SHARES, STAKE_ERR_INSUFFICIENT_VALUE, STAKE_ERR_INSUFFICIENT_WITHDRAW_CAPACITY, STAKE_ERR_INVALID_STATUS, STAKE_ERR_UNAUTHORIZED, STAKE_ERR_WRONG_CALLER } from "../wrappers/stake/stakeErr";
import { UTONIC_MANAGER_OP_ADMIN_SWITCH_OPERATOR_STATUS } from "../wrappers/stake/utonicManager/utonicManagerOp";
import { STAKE_OP_BURN, STAKE_OP_WITHDRAW } from "../wrappers/stake/stakeOp";
import StrategyWithdraw from "../wrappers/stake/strategy/strategyWithdraw/StrategyWithdraw";
import { WITHDRAW_ERR_FINISHED, WITHDRAW_ERR_TIME_NOT_EXPIRED } from "../wrappers/stake/strategy/strategyWithdraw/strategyWithdrawErr";
import StrategyJetton from "../wrappers/stake/strategy/strategyJetton/StrategyJetton";
import TestMinter from "../wrappers/test/jetton/TestMinter";
import TestJettonWallet from "../wrappers/test/jetton/TestJettonWallet";
import { STRATEGY_ERR_CAPACITY_NOT_ENOUGH } from "../wrappers/stake/strategy/strategyErr";
import { STRATEGY_OP_ADMIN_ADD_USER_SHARE, STRATEGY_OP_ADMIN_EXTRACT_TOKEN } from "../wrappers/stake/strategy/strategyOp";

describe("ton stake tests", () => {
  let blockchain: MyBlockchain;
  let admin: SandboxContract<TreasuryContract>;
  let fakeAdmin: SandboxContract<TreasuryContract>;
  let jettonReceiverAddress: SandboxContract<TreasuryContract>;
  let user1: SandboxContract<TreasuryContract>;
  let user2: SandboxContract<TreasuryContract>;
  let userResponse1: SandboxContract<TreasuryContract>;
  let userResponse2: SandboxContract<TreasuryContract>;
  let operator: SandboxContract<TreasuryContract>;
  let operatorResponse: SandboxContract<TreasuryContract>;
  let strategyJettonContract: SandboxContract<StrategyJetton>;
  let utonicManagerContract: SandboxContract<UTonicManager>;
  let jettonMinterContract: SandboxContract<TestMinter>;
  let strategyJettonWalletAddress: Address

  let startTime: number;

  const withdrawPendingTime = 3 * 24 * 60 * 60;

  beforeEach(async () =>  {

    blockchain = await MyBlockchain.create();
    startTime = Math.floor(new Date().getTime() / 1000);
    blockchain.setNowTime(startTime);
    admin = await blockchain.treasury("admin");
    fakeAdmin = await blockchain.treasury("fakeAdmin");
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
    const testJettonMinterCode = Cell.fromBoc(fs.readFileSync("build/test_jetton_minter.cell"))[0];
    const testJettonWalletCode = Cell.fromBoc(fs.readFileSync("build/test_jetton_wallet.cell"))[0];

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

    jettonMinterContract = blockchain.openContract(jettonMinter)
    await jettonMinterContract.sendDeploy(admin.getSender(), "0.1");

    const strategyJetton = StrategyJetton.createForDeploy(
        strategyJettonCode,
        StrategyJetton.initData(
            2, withdrawPendingTime, BigInt(3.3*1e9), utonicManagerContract.address,
            admin.address,
            userStrategyInfoCode, operatorStrategyShareCode, strategyWithdrawCode
        ),
    )

    strategyJettonContract = blockchain.openContract(strategyJetton)
    await strategyJettonContract.sendDeploy(admin.getSender(), "0.1")

    strategyJettonWalletAddress = await jettonMinterContract.getWalletAddress(strategyJettonContract.address)
  }),

  it("admin add share for user", async () => {
    // mint jetton
    await jettonMinterContract.sendAdminMint(admin.getSender(), 1, BigInt(100*1e9), user1.address, "0.3");
    await jettonMinterContract.sendAdminMint(admin.getSender(), 1, BigInt(100*1e9), user2.address, "0.3");
    await jettonMinterContract.sendAdminMint(admin.getSender(), 1, BigInt(10000*1e9), admin.address, "0.3");
    const userJettonWalletAddress1 = await jettonMinterContract.getWalletAddress(user1.address)
    const userJettonWalletContract1 = blockchain.openContract(
        new TestJettonWallet(userJettonWalletAddress1)
    )
    const strategyJettonWalletContract = blockchain.openContract(
        new TestJettonWallet(strategyJettonWalletAddress)
    )
    let userJettonWalletData1 = await userJettonWalletContract1.getWalletData()
    expect(userJettonWalletData1.balance).toBe(BigInt(100*1e9))

    // admin update wallet of strategy
    await strategyJettonContract.sendAdminUpdateStrategyJettonWallet(
        admin.getSender(), 1, 
        strategyJettonWalletAddress,
        "0.2"
    )
    let strategyJettonData = await strategyJettonContract.getStrategyData()
    expect(strategyJettonData.strategyJettonWallet?.toString()).toBe(strategyJettonWalletAddress.toString())

    // user1 deposit 
    let userDepositRes1 = await userJettonWalletContract1.sendTransfer(
        user1.getSender(), 1, BigInt(1.5*1e9), 
        strategyJettonContract.address, 
        userResponse1.address, 
        "1.0", "0.5"
    )
    let userInfoAddress1 = await strategyJettonContract.getUserStrategyInfoAddress(user1.address)
    let userInfo1 = UserStrategyInfo.createForDeploy(userInfoAddress1)
    let userInfoContract1 = blockchain.openContract(userInfo1)
    let userInfoData1 = await userInfoContract1.getUserStrategyInfoData()
    expect(userInfoData1.withdrawCnt).toBe(0n);
    expect(userInfoData1.shares).toBe(BigInt(1.5*1e9));
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

    // fake admin try to add for user1
    let fakeAdminAddRes = await strategyJettonContract.sendAdminAddUserShare(
        fakeAdmin.getSender(), 1, BigInt(1.6 * 1e9), user1.address, fakeAdmin.address, "0.5"
    )
    expect(fakeAdminAddRes.transactions).toHaveTransaction({
        to: strategyJettonContract.address,
        op: STRATEGY_OP_ADMIN_ADD_USER_SHARE,
        exitCode: STAKE_ERR_UNAUTHORIZED
    })
    // user1 info unchanged
    userInfoData1 = await userInfoContract1.getUserStrategyInfoData()
    expect(userInfoData1.withdrawCnt).toBe(0n);
    expect(userInfoData1.shares).toBe(BigInt(1.5*1e9));
    expect(userInfoData1.status).toBe(BigInt(USER_STRATEGY_INFO_STATUS_NO_DELEGATE));

    // admin add for user1
    let adminAddRes = await strategyJettonContract.sendAdminAddUserShare(
        admin.getSender(), 1, BigInt(1.6 * 1e9), user1.address, admin.address, "0.5"
    )
    // user1 info changed
    userInfoData1 = await userInfoContract1.getUserStrategyInfoData()
    expect(userInfoData1.withdrawCnt).toBe(0n);
    expect(userInfoData1.shares).toBe(BigInt(3.1*1e9));
    expect(userInfoData1.status).toBe(BigInt(USER_STRATEGY_INFO_STATUS_NO_DELEGATE));

    // user1 init
    let userInitRes1 = await strategyJettonContract.sendInitUserInfo(
        user1.getSender(), 1, userResponse1.address, "0.1"
    )
    userInfoData1 = await userInfoContract1.getUserStrategyInfoData()
    // unchanged after init
    expect(userInfoData1.withdrawCnt).toBe(0n);
    expect(userInfoData1.shares).toBe(BigInt(3.1 * 1e9));
    expect(userInfoData1.status).toBe(BigInt(USER_STRATEGY_INFO_STATUS_NO_DELEGATE));

    // user1 delegate
    let userDelegateRes1 = await userInfoContract1.sendDelegate(
        user1.getSender(), 3, operator.address, userResponse1.address, "0.5"
    );
    userInfoData1 = await userInfoContract1.getUserStrategyInfoData()
    expect(userInfoData1.withdrawCnt).toBe(0n);
    expect(userInfoData1.shares).toBe(BigInt(3.1*1e9));
    expect(userInfoData1.status).toBe(BigInt(USER_STRATEGY_INFO_STATUS_DELEGATE_DONE));

    let operatorStrategyShareAddress = await strategyJettonContract.getOperatorStrategyShareAddress(operator.address)
    let operatorStrategyShare = OperatorStrategyShare.createForDeploy(operatorStrategyShareAddress)
    let operatorStrategyShareContract = blockchain.openContract(operatorStrategyShare)
    let operatorStrategyShareData = await operatorStrategyShareContract.getOperatorStrategyShareData()
    expect(operatorStrategyShareData.operatorAddress.toString()).toBe(operator.address.toString())
    expect(operatorStrategyShareData.strategyAddress.toString()).toBe(strategyJettonContract.address.toString())
    expect(operatorStrategyShareData.shares).toBe(BigInt(3.1*1e9))

    // user1 init again
    userInitRes1 = await strategyJettonContract.sendInitUserInfo(
        user1.getSender(), 1, userResponse1.address, "0.1"
    )
    userInfoData1 = await userInfoContract1.getUserStrategyInfoData()
    // unchanged after init
    expect(userInfoData1.withdrawCnt).toBe(0n);
    expect(userInfoData1.shares).toBe(BigInt(3.1 * 1e9));
    expect(userInfoData1.status).toBe(BigInt(USER_STRATEGY_INFO_STATUS_DELEGATE_DONE));

  });

});