import * as fs from "fs";
import { Address, beginCell, Cell } from "@ton/core";
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
import { STAKE_OP_ADD_OPT_SHARE, STAKE_OP_BURN, STAKE_OP_CANCEL_PENDING, STAKE_OP_CLAIM_OPT_SHARE, STAKE_OP_CLAIM_OPT_SHARE_ACK, STAKE_OP_DEC_OPT_SHARE, STAKE_OP_DELEGATE, STAKE_OP_DELEGATE_ACK, STAKE_OP_DEPOSIT, STAKE_OP_DEPOSIT_ACK, STAKE_OP_INIT, STAKE_OP_QUERY_ACK, STAKE_OP_UNDELEGATE, STAKE_OP_UNDELEGATE_ACK, STAKE_OP_UPDATE_OPT_SHARE_ACK, STAKE_OP_WITHDRAW } from "../wrappers/stake/stakeOp";
import StrategyWithdraw from "../wrappers/stake/strategy/strategyWithdraw/StrategyWithdraw";
import { WITHDRAW_ERR_FINISHED, WITHDRAW_ERR_TIME_NOT_EXPIRED } from "../wrappers/stake/strategy/strategyWithdraw/strategyWithdrawErr";
import StrategyJetton from "../wrappers/stake/strategy/strategyJetton/StrategyJetton";
import TestMinter from "../wrappers/test/jetton/TestMinter";
import TestJettonWallet from "../wrappers/test/jetton/TestJettonWallet";
import { STRATEGY_ERR_CAPACITY_NOT_ENOUGH } from "../wrappers/stake/strategy/strategyErr";
import { STRATEGY_OP_ADMIN_EXTRACT_TOKEN } from "../wrappers/stake/strategy/strategyOp";

describe("ton stake tests", () => {
  let blockchain: MyBlockchain;
  let admin: SandboxContract<TreasuryContract>;
  let otherCaller: SandboxContract<TreasuryContract>;
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
    otherCaller = await blockchain.treasury("otherCaller");
    jettonReceiverAddress = await blockchain.treasury("jettonReceiverAddress");
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

  it("stake", async () => {
    // other caller init
    let otherCallerInitRes = await strategyJettonContract.sendInitUserInfo(
        otherCaller.getSender(), 1, otherCaller.address, "1.8"
    );
    let otherCallerInfoAddress = await strategyJettonContract.getUserStrategyInfoAddress(otherCaller.address)
    let otherCallerInfo = UserStrategyInfo.createForDeploy(otherCallerInfoAddress)
    let otherCallerInfoContract = blockchain.openContract(otherCallerInfo)
    let otherCallerInfoData = await otherCallerInfoContract.getUserStrategyInfoData()
    expect(otherCallerInfoData.withdrawCnt).toBe(0n);
    expect(otherCallerInfoData.shares).toBe(0n);
    expect(otherCallerInfoData.status).toBe(BigInt(USER_STRATEGY_INFO_STATUS_NO_DELEGATE));
    let strategy = strategyJettonContract;
    // mint jetton
    await jettonMinterContract.sendAdminMint(admin.getSender(), 1, BigInt(100*1e9), user1.address, "0.3");
    await jettonMinterContract.sendAdminMint(admin.getSender(), 1, BigInt(100*1e9), user2.address, "0.3");
    await jettonMinterContract.sendAdminMint(admin.getSender(), 1, BigInt(10000*1e9), admin.address, "0.3");
    const userJettonWalletAddress1 = await jettonMinterContract.getWalletAddress(user1.address)
    const userJettonWalletContract1 = blockchain.openContract(
        new TestJettonWallet(userJettonWalletAddress1)
    )
    const userJettonWalletAddress2 = await jettonMinterContract.getWalletAddress(user2.address)
    const userJettonWalletContract2 = blockchain.openContract(
        new TestJettonWallet(userJettonWalletAddress2)
    )
    const adminJettonWalletAddress = await jettonMinterContract.getWalletAddress(admin.address)
    const adminJettonWalletContract = blockchain.openContract(
        new TestJettonWallet(adminJettonWalletAddress)
    )
    let userJettonWalletData1 = await userJettonWalletContract1.getWalletData()
    let userJettonWalletData2 = await userJettonWalletContract2.getWalletData()
    expect(userJettonWalletData1.balance).toBe(BigInt(100*1e9))
    expect(userJettonWalletData2.balance).toBe(BigInt(100*1e9))

    // admin update wallet of strategy
    await strategyJettonContract.sendAdminUpdateStrategyJettonWallet(
        admin.getSender(), 1, 
        strategyJettonWalletAddress,
        "0.2"
    )

    // user1 deposit 
    let userDepositRes1 = await userJettonWalletContract1.sendTransfer(
        user1.getSender(), 1, BigInt(1.6*1e9), 
        strategyJettonContract.address, 
        userResponse1.address, 
        "1.0", "0.5"
    )
    let userInfoAddress1 = await strategyJettonContract.getUserStrategyInfoAddress(user1.address)
    let userInfo1 = UserStrategyInfo.createForDeploy(userInfoAddress1)
    let userInfoContract1 = blockchain.openContract(userInfo1)
    let userInfoData1 = await userInfoContract1.getUserStrategyInfoData()
    expect(userInfoData1.withdrawCnt).toBe(0n);
    expect(userInfoData1.shares).toBe(BigInt(1.6*1e9));
    expect(userInfoData1.status).toBe(BigInt(USER_STRATEGY_INFO_STATUS_NO_DELEGATE));

    // user2 deposit 
    let userDepositRes2 = await userJettonWalletContract2.sendTransfer(
        user2.getSender(), 1, BigInt(1.5*1e9), 
        strategyJettonContract.address, 
        userResponse2.address, 
        "1.0", "0.5"
    )
    let userInfoAddress2 = await strategyJettonContract.getUserStrategyInfoAddress(user2.address)
    let userInfo2 = UserStrategyInfo.createForDeploy(userInfoAddress2)
    let userInfoContract2 = blockchain.openContract(userInfo2)
    let userInfoData2 = await userInfoContract2.getUserStrategyInfoData()
    expect(userInfoData2.withdrawCnt).toBe(0n);
    expect(userInfoData2.shares).toBe(BigInt(1.5*1e9));
    expect(userInfoData2.status).toBe(BigInt(USER_STRATEGY_INFO_STATUS_NO_DELEGATE));

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
        user1.getSender(), 3, operator.address, userResponse1.address, "0.5"
    );
    // printTransactionFees(userDelegateRes1.transactions)
    userInfoData1 = await userInfoContract1.getUserStrategyInfoData()
    expect(userInfoData1.withdrawCnt).toBe(0n);
    expect(userInfoData1.shares).toBe(BigInt(1.6*1e9));
    expect(userInfoData1.status).toBe(BigInt(USER_STRATEGY_INFO_STATUS_DELEGATE_DONE));
    
    
    let operatorStrategyShareAddress = await strategyJettonContract.getOperatorStrategyShareAddress(operator.address)
    let operatorStrategyShare = OperatorStrategyShare.createForDeploy(operatorStrategyShareAddress)
    let operatorStrategyShareContract = blockchain.openContract(operatorStrategyShare)
    let operatorStrategyShareData = await operatorStrategyShareContract.getOperatorStrategyShareData()
    expect(operatorStrategyShareData.operatorAddress.toString()).toBe(operator.address.toString())
    expect(operatorStrategyShareData.strategyAddress.toString()).toBe(strategyJettonContract.address.toString())
    expect(operatorStrategyShareData.shares).toBe(BigInt(1.6*1e9))

    // user1 burn
    let userBurnTimestamp2 = startTime + 1000;
    let currentTimestamp = userBurnTimestamp2;
    blockchain.setNowTime(currentTimestamp)
    let userBurnRes2 = await userInfoContract2.sendBurn(
        user2.getSender(), 1, BigInt(0.6*1e9), userResponse2.address, "0.2"
    )
    userInfoData2 = await userInfoContract2.getUserStrategyInfoData()
    expect(userInfoData2.withdrawCnt).toBe(1n);
    expect(userInfoData2.shares).toBe(BigInt(0.9*1e9));
    expect(userInfoData2.status).toBe(BigInt(USER_STRATEGY_INFO_STATUS_NO_DELEGATE));

    const userWithdrawAddress2_1 = await strategyJettonContract.getStrategyWithdrawAddress(1n, user2.address);
    const userWithdraw2_1 = StrategyWithdraw.createForDeploy(userWithdrawAddress2_1)
    const userWithdrawContract2_1 = blockchain.openContract(userWithdraw2_1)
    let userWithdrawData2_1 = await userWithdrawContract2_1.getStrategyWithdrawData()
    expect(userWithdrawData2_1.burnTimestamp).toBe(BigInt(currentTimestamp))
    expect(userWithdrawData2_1.earliestWithdrawTimestamp).toBe(BigInt(currentTimestamp + withdrawPendingTime))
    expect(userWithdrawData2_1.finished).toBe(0n)
    expect(userWithdrawData2_1.ownerAddress.toString()).toBe(user2.address.toString())
    expect(userWithdrawData2_1.strategy_address.toString()).toBe(strategyJettonContract.address.toString())
    expect(userWithdrawData2_1.shares).toBe(BigInt(0.6*1e9))
    expect(userWithdrawData2_1.withdrawId).toBe(1n)

    currentTimestamp = userBurnTimestamp2 + withdrawPendingTime + 1;
    blockchain.setNowTime(currentTimestamp);
    // send enough token to strategy contract
    await adminJettonWalletContract.sendTransfer(admin.getSender(), 6, BigInt(10*1e9), strategyJettonContract.address, admin.address, "0.2", "0")
    const userJettonDataBeforeWithdraw2_1 = await userJettonWalletContract2.getWalletData()
    

    // check wrong caller
    let txn = await operatorRegisterContract.sendInit(otherCaller.getSender(), 1, otherCaller.address, "1.0")
    expect(txn.transactions).toHaveTransaction({
        to: operatorRegisterContract.address,
        op: STAKE_OP_INIT,
        exitCode: STAKE_ERR_WRONG_CALLER,
    })
    txn = await operatorRegisterContract.sendSwitchOperatorStatus(otherCaller.getSender(), 1, true, otherCaller.address, "1.0")
    expect(txn.transactions).toHaveTransaction({
        to: operatorRegisterContract.address,
        op: UTONIC_MANAGER_OP_ADMIN_SWITCH_OPERATOR_STATUS,
        exitCode: STAKE_ERR_WRONG_CALLER,
    })
    txn = await operatorRegisterContract.sendSwitchOperatorStatus(otherCaller.getSender(), 1, false, otherCaller.address, "1.0")
    expect(txn.transactions).toHaveTransaction({
        to: operatorRegisterContract.address,
        op: UTONIC_MANAGER_OP_ADMIN_SWITCH_OPERATOR_STATUS,
        exitCode: STAKE_ERR_WRONG_CALLER,
    })

    txn = await utonicManagerContract.sendQueryAck(otherCaller.getSender(), 1, OPERATOR_REGISTER_STATUS_NORMAL, operator.address, "1.0")
    expect(txn.transactions).toHaveTransaction({
        to: utonicManagerContract.address,
        op: STAKE_OP_QUERY_ACK,
        exitCode: STAKE_ERR_WRONG_CALLER,
    })
    txn = await utonicManagerContract.sendQueryAck(otherCaller.getSender(), 1, OPERATOR_REGISTER_STATUS_BANED, otherCaller.address, "1.0")
    expect(txn.transactions).toHaveTransaction({
        to: utonicManagerContract.address,
        op: STAKE_OP_QUERY_ACK,
        exitCode: STAKE_ERR_WRONG_CALLER,
    })
    txn = await operatorStrategyShareContract.sendAddOptShare(otherCaller.getSender(), 1, 100000000n, true, beginCell().endCell(), "1.0")
    expect(txn.transactions).toHaveTransaction({
        to: operatorStrategyShareContract.address,
        op: STAKE_OP_ADD_OPT_SHARE,
        exitCode: STAKE_ERR_WRONG_CALLER,
    })
    txn = await operatorStrategyShareContract.sendDecOptShare(otherCaller.getSender(), 1, 100000000n, false, beginCell().endCell(), "1.0")
    expect(txn.transactions).toHaveTransaction({
        to: operatorStrategyShareContract.address,
        op: STAKE_OP_DEC_OPT_SHARE,
        exitCode: STAKE_ERR_WRONG_CALLER,
    })
    txn = await operatorStrategyShareContract.sendClaimShares(otherCaller.getSender(), 1, otherCaller.address, "1.0")
    expect(txn.transactions).toHaveTransaction({
        to: operatorStrategyShareContract.address,
        op: STAKE_OP_CLAIM_OPT_SHARE,
        exitCode: STAKE_ERR_WRONG_CALLER,
    })
    // nothing changed
    otherCallerInfoData = await otherCallerInfoContract.getUserStrategyInfoData()
    expect(otherCallerInfoData.withdrawCnt).toBe(0n);
    expect(otherCallerInfoData.shares).toBe(0n);
    expect(otherCallerInfoData.status).toBe(BigInt(USER_STRATEGY_INFO_STATUS_NO_DELEGATE));

    txn = await strategy.sendDepositAck(otherCaller.getSender(), 1, 10000000n, otherCaller.address, "1.0")
    expect(txn.transactions).toHaveTransaction({
        to: strategy.address,
        op: STAKE_OP_DEPOSIT_ACK,
        exitCode: STAKE_ERR_WRONG_CALLER,
    })
    // nothing changed
    otherCallerInfoData = await otherCallerInfoContract.getUserStrategyInfoData()
    expect(otherCallerInfoData.withdrawCnt).toBe(0n);
    expect(otherCallerInfoData.shares).toBe(0n);
    expect(otherCallerInfoData.status).toBe(BigInt(USER_STRATEGY_INFO_STATUS_NO_DELEGATE));

    txn = await strategy.sendBurn(otherCaller.getSender(), 1, 10000000n, 1, otherCaller.address, otherCaller.address, "1.0")
    expect(txn.transactions).toHaveTransaction({
        to: strategy.address,
        op: STAKE_OP_BURN,
        exitCode: STAKE_ERR_WRONG_CALLER,
    })

    // nothing changed
    otherCallerInfoData = await otherCallerInfoContract.getUserStrategyInfoData()
    expect(otherCallerInfoData.withdrawCnt).toBe(0n);
    expect(otherCallerInfoData.shares).toBe(0n);
    expect(otherCallerInfoData.status).toBe(BigInt(USER_STRATEGY_INFO_STATUS_NO_DELEGATE));

    txn = await strategy.sendWithdraw(otherCaller.getSender(), 1, 5000000000n, 1, user2.address, otherCaller.address, otherCaller.address, "1.0")
    // printTransactionFees(txn.transactions)
    expect(txn.transactions).toHaveTransaction({
        to: strategy.address,
        op: STAKE_OP_WITHDRAW,
        exitCode: STAKE_ERR_WRONG_CALLER,
    })
   
    txn = await strategy.sendDelegate(otherCaller.getSender(), 1, 5000000000n, otherCaller.address, operator.address, otherCaller.address, "1.0")
    // printTransactionFees(txn.transactions)
    expect(txn.transactions).toHaveTransaction({
        to: strategy.address,
        op: STAKE_OP_DELEGATE,
        exitCode: STAKE_ERR_WRONG_CALLER,
    })

    // nothing changed
    otherCallerInfoData = await otherCallerInfoContract.getUserStrategyInfoData()
    expect(otherCallerInfoData.withdrawCnt).toBe(0n);
    expect(otherCallerInfoData.shares).toBe(0n);
    expect(otherCallerInfoData.status).toBe(BigInt(USER_STRATEGY_INFO_STATUS_NO_DELEGATE));

    txn = await strategy.sendUndelegate(otherCaller.getSender(), 1, 5000000000n, user1.address, operator.address, otherCaller.address, "1.0")
    // printTransactionFees(txn.transactions)
    expect(txn.transactions).toHaveTransaction({
        to: strategy.address,
        op: STAKE_OP_UNDELEGATE,
        exitCode: STAKE_ERR_WRONG_CALLER,
    })

    // nothing changed
    userInfoData1 = await userInfoContract1.getUserStrategyInfoData()
    expect(userInfoData1.withdrawCnt).toBe(0n);
    expect(userInfoData1.shares).toBe(BigInt(1.6*1e9));
    expect(userInfoData1.status).toBe(BigInt(USER_STRATEGY_INFO_STATUS_DELEGATE_DONE));
    
    txn = await strategy.sendQueryAck(otherCaller.getSender(), 1, OPERATOR_REGISTER_STATUS_NORMAL, operator.address, otherCaller.address, beginCell().endCell(), "1.0")
    // printTransactionFees(txn.transactions)
    expect(txn.transactions).toHaveTransaction({
        to: strategy.address,
        op: STAKE_OP_QUERY_ACK,
        exitCode: STAKE_ERR_WRONG_CALLER,
    })
    txn = await strategy.sendUpdateOptShareAck(otherCaller.getSender(), 1, operator.address, otherCaller.address, beginCell().endCell(), "1.0")
    // printTransactionFees(txn.transactions)
    expect(txn.transactions).toHaveTransaction({
        to: strategy.address,
        op: STAKE_OP_UPDATE_OPT_SHARE_ACK,
        exitCode: STAKE_ERR_WRONG_CALLER,
    })
    txn = await strategy.sendClaimOptShare(otherCaller.getSender(), 1, operator.address, otherCaller.address, "1.0")
    // printTransactionFees(txn.transactions)
    expect(txn.transactions).toHaveTransaction({
        to: strategy.address,
        op: STAKE_OP_CLAIM_OPT_SHARE,
        exitCode: STAKE_ERR_WRONG_CALLER,
    })
    // nothing changed
    otherCallerInfoData = await otherCallerInfoContract.getUserStrategyInfoData()
    expect(otherCallerInfoData.withdrawCnt).toBe(0n);
    expect(otherCallerInfoData.shares).toBe(0n);
    expect(otherCallerInfoData.status).toBe(BigInt(USER_STRATEGY_INFO_STATUS_NO_DELEGATE));

    txn = await strategy.sendClaimOptShareAck(otherCaller.getSender(), 1, 5000000000n, operator.address, otherCaller.address, "1.0")
    // printTransactionFees(txn.transactions)
    expect(txn.transactions).toHaveTransaction({
        to: strategy.address,
        op: STAKE_OP_CLAIM_OPT_SHARE_ACK,
        exitCode: STAKE_ERR_WRONG_CALLER,
    })
    // nothing changed
    otherCallerInfoData = await otherCallerInfoContract.getUserStrategyInfoData()
    expect(otherCallerInfoData.withdrawCnt).toBe(0n);
    expect(otherCallerInfoData.shares).toBe(0n);
    expect(otherCallerInfoData.status).toBe(BigInt(USER_STRATEGY_INFO_STATUS_NO_DELEGATE));


    txn = await otherCallerInfoContract.sendCancelPending(otherCaller.getSender(), 1, otherCaller.address, "1.0")
    // printTransactionFees(txn.transactions)
    expect(txn.transactions).toHaveTransaction({
        to: otherCallerInfoContract.address,
        op: STAKE_OP_CANCEL_PENDING,
        exitCode: STAKE_ERR_WRONG_CALLER,
    })
    // nothing changed
    otherCallerInfoData = await otherCallerInfoContract.getUserStrategyInfoData()
    expect(otherCallerInfoData.withdrawCnt).toBe(0n);
    expect(otherCallerInfoData.shares).toBe(0n);
    expect(otherCallerInfoData.status).toBe(BigInt(USER_STRATEGY_INFO_STATUS_NO_DELEGATE));

    txn = await otherCallerInfoContract.sendDelegateAck(otherCaller.getSender(), 1, otherCaller.address, "1.0")
    // printTransactionFees(txn.transactions)
    expect(txn.transactions).toHaveTransaction({
        to: otherCallerInfoContract.address,
        op: STAKE_OP_DELEGATE_ACK,
        exitCode: STAKE_ERR_WRONG_CALLER,
    })
    // nothing changed
    otherCallerInfoData = await otherCallerInfoContract.getUserStrategyInfoData()
    expect(otherCallerInfoData.withdrawCnt).toBe(0n);
    expect(otherCallerInfoData.shares).toBe(0n);
    expect(otherCallerInfoData.status).toBe(BigInt(USER_STRATEGY_INFO_STATUS_NO_DELEGATE));

    txn = await userInfoContract1.sendUndelegateAck(user1.getSender(), 1, userResponse1.address, "1.0")
    // printTransactionFees(txn.transactions)
    expect(txn.transactions).toHaveTransaction({
        to: userInfoContract1.address,
        op: STAKE_OP_UNDELEGATE_ACK,
        exitCode: STAKE_ERR_WRONG_CALLER,
    })
    // nothing changed
    userInfoData1 = await userInfoContract1.getUserStrategyInfoData()
    expect(userInfoData1.withdrawCnt).toBe(0n);
    expect(userInfoData1.shares).toBe(BigInt(1.6*1e9));
    expect(userInfoData1.status).toBe(BigInt(USER_STRATEGY_INFO_STATUS_DELEGATE_DONE));

    txn = await otherCallerInfoContract.sendDeposit(otherCaller.getSender(), 1, 5000000000n, otherCaller.address, "1.0")
    // printTransactionFees(txn.transactions)
    expect(txn.transactions).toHaveTransaction({
        to: otherCallerInfoContract.address,
        op: STAKE_OP_DEPOSIT,
        exitCode: STAKE_ERR_WRONG_CALLER,
    })
    // nothing changed
    otherCallerInfoData = await otherCallerInfoContract.getUserStrategyInfoData()
    expect(otherCallerInfoData.withdrawCnt).toBe(0n);
    expect(otherCallerInfoData.shares).toBe(0n);
    expect(otherCallerInfoData.status).toBe(BigInt(USER_STRATEGY_INFO_STATUS_NO_DELEGATE));

    
    // user2's withdrawal not influenced
    let userWithdrawRes2_1 = await userWithdrawContract2_1.sendWithdraw(
        user2.getSender(), 8, user2.address, userResponse2.address, "0.5"
    )
    // check withdraw success
    const userJettonDataAfterWithdraw2_1 = await userJettonWalletContract2.getWalletData()
    expect(userJettonDataAfterWithdraw2_1.balance-userJettonDataBeforeWithdraw2_1.balance).toBe(BigInt(0.6*1e9))
   
    userWithdrawData2_1 = await userWithdrawContract2_1.getStrategyWithdrawData()
    expect(userWithdrawData2_1.finished).toBe(1n)
    expect(userWithdrawData2_1.ownerAddress.toString()).toBe(user2.address.toString())
    expect(userWithdrawData2_1.strategy_address.toString()).toBe(strategyJettonContract.address.toString())
    expect(userWithdrawData2_1.shares).toBe(BigInt(0.6*1e9))
    expect(userWithdrawData2_1.withdrawId).toBe(1n)

    // user1 withdraw again but fail
    userWithdrawRes2_1 = await userWithdrawContract2_1.sendWithdraw(
        user2.getSender(), 1, user2.address, userResponse2.address, "0.5"
    )
    const userJettonDataAfterWithdrawAgain2_1 = await userJettonWalletContract2.getWalletData()
    // check withdraw fail
    expect(userJettonDataAfterWithdrawAgain2_1.balance-userJettonDataAfterWithdraw2_1.balance).toBe(0n)
    expect(userWithdrawRes2_1.transactions).toHaveTransaction(
        {
            to: userWithdrawContract2_1.address,
            exitCode: WITHDRAW_ERR_FINISHED
        }
    )
    userWithdrawData2_1 = await userWithdrawContract2_1.getStrategyWithdrawData()
    expect(userWithdrawData2_1.finished).toBe(1n)
    expect(userWithdrawData2_1.ownerAddress.toString()).toBe(user2.address.toString())
    expect(userWithdrawData2_1.strategy_address.toString()).toBe(strategyJettonContract.address.toString())
    expect(userWithdrawData2_1.shares).toBe(BigInt(0.6*1e9))
    expect(userWithdrawData2_1.withdrawId).toBe(1n)
  });

});