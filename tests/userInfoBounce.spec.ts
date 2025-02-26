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
import { STAKE_OP_BURN, STAKE_OP_WITHDRAW } from "../wrappers/stake/stakeOp";
import StrategyWithdraw from "../wrappers/stake/strategy/strategyWithdraw/StrategyWithdraw";
import { WITHDRAW_ERR_FINISHED, WITHDRAW_ERR_TIME_NOT_EXPIRED } from "../wrappers/stake/strategy/strategyWithdraw/strategyWithdrawErr";
import { STRATEGY_OP_ADMIN_EXTRACT_TOKEN } from "../wrappers/stake/strategy/strategyOp";

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
    // user1 deposit
    let userDepositRes1 = await strategyTonContract.sendDeposit(
        user1.getSender(), 1, BigInt(1.6*1e9), userResponse1.address, "1.8"
    );
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
    
    const stakeTestUpdateCode = Cell.fromBoc(fs.readFileSync("build/stake_test_update_code.cell"))[0];
    let adminUpdateCode = await strategyTonContract.sendAdminUpdateCode(admin.getSender(), 1, stakeTestUpdateCode, "0.5");

    // user1 undelegate bounced
    let userUndelegate1 = await userInfoContract1.sendUndelegate(user1.getSender(), 1, userResponse1.address, "0.5");
    expect(userUndelegate1.transactions).toHaveTransaction({
        to: userInfoContract1.address,
        inMessageBounced: true
    });
    // nothing changed
    userInfoData1 = await userInfoContract1.getUserStrategyInfoData()
    expect(userInfoData1.withdrawCnt).toBe(0n);
    expect(userInfoData1.shares).toBe(BigInt(1.6*1e9));
    expect(userInfoData1.status).toBe(BigInt(USER_STRATEGY_INFO_STATUS_DELEGATE_DONE));

    // user2 delegate bounced
    let userDelegate2 = await userInfoContract2.sendDelegate(user2.getSender(), 1, operator.address, userResponse2.address, "0.5");
    expect(userDelegate2.transactions).toHaveTransaction({
        to: userInfoContract2.address,
        inMessageBounced: true
    });
    // nothing changed
    userInfoData2 = await userInfoContract2.getUserStrategyInfoData()
    expect(userInfoData2.withdrawCnt).toBe(0n);
    expect(userInfoData2.shares).toBe(BigInt(1.5*1e9));
    expect(userInfoData2.status).toBe(BigInt(USER_STRATEGY_INFO_STATUS_NO_DELEGATE));

    // user2 burn bounced
    let userBurn2 = await userInfoContract2.sendBurn(user2.getSender(), 1, BigInt(0.6*1e9), userResponse1.address, "0.5");
    expect(userBurn2.transactions).toHaveTransaction({
        to: userInfoContract2.address,
        inMessageBounced: true
    });
    userInfoData2 = await userInfoContract2.getUserStrategyInfoData()
    // only withdrawCnt increased
    expect(userInfoData2.withdrawCnt).toBe(1n);
    expect(userInfoData2.shares).toBe(BigInt(1.5*1e9));
    expect(userInfoData2.status).toBe(BigInt(USER_STRATEGY_INFO_STATUS_NO_DELEGATE));

  });

});