import { Cell } from "@ton/core";
import { Blockchain, BlockchainStorage, Executor, LocalBlockchainStorage, MessageParams } from "@ton/sandbox";

export class MyBlockchain extends Blockchain {
    nowTime: number = 0;

    protected getNowTime() {
        if (this.nowTime === 0) {
            const t = Math.floor(new Date().getTime() / 1000)
            return t;
        }
        return this.nowTime;
    }

    protected async processQueue(params?: MessageParams) {
        return await super.processQueue({
            ...params,
            now: this.getNowTime(),
        })
    }

    setNowTime(nowTime: number) {
        this.nowTime = nowTime;
    }

    static async create(opts?: { config?: Cell, storage?: BlockchainStorage }) {
        return new MyBlockchain({
            executor: await Executor.create(),
            storage: opts?.storage ?? new LocalBlockchainStorage(),
            ...opts
        })
    }
}