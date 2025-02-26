import * as fs from "fs";
import { beginCell, Cell } from "@ton/core";
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
import { STAKE_OP_ADD_OPT_SHARE, STAKE_OP_BURN, STAKE_OP_CANCEL_PENDING, STAKE_OP_CLAIM_OPT_SHARE, STAKE_OP_CLAIM_OPT_SHARE_ACK, STAKE_OP_DEC_OPT_SHARE, STAKE_OP_DELEGATE, STAKE_OP_DELEGATE_ACK, STAKE_OP_DEPOSIT, STAKE_OP_DEPOSIT_ACK, STAKE_OP_INIT, STAKE_OP_QUERY_ACK, STAKE_OP_UNDELEGATE, STAKE_OP_UNDELEGATE_ACK, STAKE_OP_UPDATE_OPT_SHARE_ACK, STAKE_OP_WITHDRAW } from "../wrappers/stake/stakeOp";
import StrategyWithdraw from "../wrappers/stake/strategy/strategyWithdraw/StrategyWithdraw";
import { WITHDRAW_ERR_FINISHED, WITHDRAW_ERR_TIME_NOT_EXPIRED } from "../wrappers/stake/strategy/strategyWithdraw/strategyWithdrawErr";
import { STRATEGY_OP_ADMIN_EXTRACT_TOKEN } from "../wrappers/stake/strategy/strategyOp";

describe("ton stake tests", () => {
  let blockchain: MyBlockchain;
  let admin: SandboxContract<TreasuryContract>;
  let otherCaller: SandboxContract<TreasuryContract>;
  let tonReceiver: SandboxContract<TreasuryContract>;
  let user1: SandboxContract<TreasuryContract>;
  let user2: SandboxContract<TreasuryContract>;
  let userResponse1: SandboxContract<TreasuryContract>;
  let userResponse2: SandboxContract<TreasuryContract>;
  let operator: SandboxContract<TreasuryContract>;
  let operatorResponse: SandboxContract<TreasuryContract>;
  let strategyTonContract: SandboxContract<StrategyTon>;
  let utonicManagerContract: SandboxContract<UTonicManager>;

  let startTime: number;

  const withdrawPendingTime = 3 * 24 * 60 * 60;

  beforeEach(async () =>  {

    blockchain = await MyBlockchain.create();
    startTime = Math.floor(new Date().getTime() / 1000);
    blockchain.setNowTime(startTime);
    admin = await blockchain.treasury("admin");
    otherCaller = await blockchain.treasury("otherCaller");
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
            1, withdrawPendingTime, utonicManagerContract.address,tonReceiver.address, admin.address,
            userStrategyInfoCode, operatorStrategyShareCode, strategyWithdrawCode
        ),
    )

    strategyTonContract = blockchain.openContract(strategyTon)
    await strategyTonContract.sendDeploy(admin.getSender(), "0.1")

  }),

  it("stake", async () => {
    // other caller init
    let otherCallerInitRes = await strategyTonContract.sendInitUserInfo(
        otherCaller.getSender(), 1, otherCaller.address, "1.8"
    );
    let otherCallerInfoAddress = await strategyTonContract.getUserStrategyInfoAddress(otherCaller.address)
    let otherCallerInfo = UserStrategyInfo.createForDeploy(otherCallerInfoAddress)
    let otherCallerInfoContract = blockchain.openContract(otherCallerInfo)
    let otherCallerInfoData = await otherCallerInfoContract.getUserStrategyInfoData()
    expect(otherCallerInfoData.withdrawCnt).toBe(0n);
    expect(otherCallerInfoData.shares).toBe(0n);
    expect(otherCallerInfoData.status).toBe(BigInt(USER_STRATEGY_INFO_STATUS_NO_DELEGATE));
    let strategy = strategyTonContract;

    // user1 deposit
    let userDepositRes1 = await strategyTonContract.sendDeposit(
        user1.getSender(), 1, BigInt(1.6*1e9), userResponse1.address, "1.8"
    );
    expect(userDepositRes1.transactions).toHaveTransaction(
        {
            from: strategyTonContract.address,
            to: tonReceiver.address,
            value: BigInt(1.6*1e9)
        }
    )
    let userInfoAddress1 = await strategyTonContract.getUserStrategyInfoAddress(user1.address)
    let userInfo1 = UserStrategyInfo.createForDeploy(userInfoAddress1)
    let userInfoContract1 = blockchain.openContract(userInfo1)
    let userInfoData1 = await userInfoContract1.getUserStrategyInfoData()
    expect(userInfoData1.withdrawCnt).toBe(0n);
    expect(userInfoData1.shares).toBe(BigInt(1.6*1e9));
    expect(userInfoData1.status).toBe(BigInt(USER_STRATEGY_INFO_STATUS_NO_DELEGATE));
   
    // user2 deposit
    let userDepositRes2 = await strategyTonContract.sendDeposit(
        user2.getSender(), 1, BigInt(1.5*1e9), userResponse2.address, "1.8"
    );
    expect(userDepositRes2.transactions).toHaveTransaction(
        {
            from: strategyTonContract.address,
            to: tonReceiver.address,
            value: BigInt(1.5*1e9)
        }
    )
    let userInfoAddress2 = await strategyTonContract.getUserStrategyInfoAddress(user2.address)
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
    
    let operatorStrategyShareAddress = await strategyTonContract.getOperatorStrategyShareAddress(operator.address)
    let operatorStrategyShare = OperatorStrategyShare.createForDeploy(operatorStrategyShareAddress)
    let operatorStrategyShareContract = blockchain.openContract(operatorStrategyShare)
    let operatorStrategyShareData = await operatorStrategyShareContract.getOperatorStrategyShareData()
    expect(operatorStrategyShareData.operatorAddress.toString()).toBe(operator.address.toString())
    expect(operatorStrategyShareData.strategyAddress.toString()).toBe(strategyTonContract.address.toString())
    expect(operatorStrategyShareData.shares).toBe(BigInt(1.6*1e9))
    
    operatorRegisterData = await operatorRegisterContract.getOperatorRegisterData()
    expect(operatorRegisterData.operatorAddress.toString()).toBe(operator.address.toString())
    expect(operatorRegisterData.utonicManagerAddress.toString()).toBe(utonicManagerContract.address.toString())
    expect(operatorRegisterData.status).toBe(BigInt(OPERATOR_REGISTER_STATUS_NORMAL))
    // user2 burn
    let userBurnTimestamp2 = startTime + 1000;
    let currentTimestamp = userBurnTimestamp2;
    blockchain.setNowTime(currentTimestamp)
    let userBurnRes2 = await userInfoContract2.sendBurn(
        user2.getSender(), 1, BigInt(0.6*1e9), userResponse1.address, "0.2"
    )
    userInfoData2 = await userInfoContract2.getUserStrategyInfoData()
    expect(userInfoData2.withdrawCnt).toBe(1n);
    expect(userInfoData2.shares).toBe(BigInt(0.9*1e9));
    expect(userInfoData2.status).toBe(BigInt(USER_STRATEGY_INFO_STATUS_NO_DELEGATE));

    const userWithdrawAddress2_1 = await strategyTonContract.getStrategyWithdrawAddress(1n, user2.address);
    const userWithdraw2_1 = StrategyWithdraw.createForDeploy(userWithdrawAddress2_1)
    const userWithdrawContract2_1 = blockchain.openContract(userWithdraw2_1)
    let userWithdrawData2_1 = await userWithdrawContract2_1.getStrategyWithdrawData()
    expect(userWithdrawData2_1.burnTimestamp).toBe(BigInt(currentTimestamp))
    expect(userWithdrawData2_1.earliestWithdrawTimestamp).toBe(BigInt(currentTimestamp + withdrawPendingTime))
    expect(userWithdrawData2_1.finished).toBe(0n)
    expect(userWithdrawData2_1.ownerAddress.toString()).toBe(user2.address.toString())
    expect(userWithdrawData2_1.strategy_address.toString()).toBe(strategyTonContract.address.toString())
    expect(userWithdrawData2_1.shares).toBe(BigInt(0.6*1e9))
    expect(userWithdrawData2_1.withdrawId).toBe(1n)

    let adminBanRes = await utonicManagerContract.sendAdminSwitchOperatorStatus(
        admin.getSender(), 16, true, operator.address, admin.address, "0.1"
    )
    operatorRegisterData = await operatorRegisterContract.getOperatorRegisterData()
    expect(operatorRegisterData.operatorAddress.toString()).toBe(operator.address.toString())
    expect(operatorRegisterData.utonicManagerAddress.toString()).toBe(utonicManagerContract.address.toString())
    expect(operatorRegisterData.status).toBe(BigInt(OPERATOR_REGISTER_STATUS_BANED))

    blockchain.setNowTime(currentTimestamp + withdrawPendingTime)
    // deposit enough token to strategy contract
    await strategyTonContract.sendValue(admin.getSender(), "5.0");

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

    // user2's withdrawal not influenced and success
    let userWithdrawRes2_1 = await userWithdrawContract2_1.sendWithdraw(
        user2.getSender(), 8, user2.address, userResponse2.address, "0.5"
    )
    // check withdraw success
    expect(userWithdrawRes2_1.transactions).toHaveTransaction(
        {
            from: strategyTonContract.address,
            to: user2.address,
            value: BigInt(0.6*1e9)
        }
    )
    userWithdrawData2_1 = await userWithdrawContract2_1.getStrategyWithdrawData()
    expect(userWithdrawData2_1.finished).toBe(1n)
    expect(userWithdrawData2_1.ownerAddress.toString()).toBe(user2.address.toString())
    expect(userWithdrawData2_1.strategy_address.toString()).toBe(strategyTonContract.address.toString())
    expect(userWithdrawData2_1.shares).toBe(BigInt(0.6*1e9))
    expect(userWithdrawData2_1.withdrawId).toBe(1n)

    // user2 withdraw again but fail
    userWithdrawRes2_1 = await userWithdrawContract2_1.sendWithdraw(
        user2.getSender(), 1, user2.address, userResponse2.address, "0.5"
    )
    // check withdraw fail
    expect(userWithdrawRes2_1.transactions).toHaveTransaction(
        {
            to: userWithdrawContract2_1.address,
            exitCode: WITHDRAW_ERR_FINISHED
        }
    )
    userWithdrawData2_1 = await userWithdrawContract2_1.getStrategyWithdrawData()
    expect(userWithdrawData2_1.finished).toBe(1n)
    expect(userWithdrawData2_1.ownerAddress.toString()).toBe(user2.address.toString())
    expect(userWithdrawData2_1.strategy_address.toString()).toBe(strategyTonContract.address.toString())
    expect(userWithdrawData2_1.shares).toBe(BigInt(0.6*1e9))
    expect(userWithdrawData2_1.withdrawId).toBe(1n)
  
  });

});