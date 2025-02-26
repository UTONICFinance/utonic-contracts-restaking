## utonic restaking

### 1. install ton-keeper

install ton-keeper on your desktop (or phone), we need `Sign in with tonkeeper` when we deploy contracts.

### 2. clone, build and test

node: 18

clone:

```
$ git clone git@github.com:UTONICFinance/utonic-contracts-restaking.git
```

install dependencies:

```
$ cd utonic-contracts-restaking
$ npm install
```

build:

```
$ mkdir build
$ yarn compile-operator-strategy-share
$ yarn compile-strategy-jetton
$ yarn compile-strategy-ton
$ yarn compile-user-strategy-info
$ yarn compile-strategy-withdraw
$ yarn compile-operator-register
$ yarn compile-utonic-manager
$ yarn compile-test-jetton-minter        # for test
$ yarn compile-test-jetton-wallet        # for test
$ yarn compile-stake-test-update-code    # for test
```

test:
before test we should complete `"build"`.

```
$ yarn jest
```

to test a single test case file like `stakeTon.spec.ts`

```
$ yarn jest tests/stakeTon.spec.ts
```

### 3. config file

create a file named `config.ini` and write following content:

```
network=mainnet

;; separated by space, like "apple cat ..."
words=${your 24 mnemonic words of ton wallet}

utonic_manager_admin_address=${address of admin}
;; init ton-balance of contract
utonic_manager_value=0.1

;; filled before deploying strategy-ton/strategy-jetton
utonic_manager=

strategy_admin_address=${address of admin}
strategy_ton_receiver=${address of ton-receiver}

;; arbitrary number
strategy_ton_id=1
withdraw_pending_time=${pending time in seconds}
;; init ton-balance of strategy-ton
strategy_ton_value=0.1


;; arbitrary number
strategy_lstton_id=2

;; maximum total amount of lstton (in decimal) user can deposit
strategy_lstton_capacity=200

;; init ton-balance of strategy-jetton
strategy_lstton_value=0.1

;; fill before setting jetton wallet of strategy-jetton
strategy_lstton=

;; fill before setting jetton wallet of strategy-jetton
lstton_jetton=ts_ton

;; minter of ts-ton
ts_ton=EQC98_qAmNEptUtPc7W6xdHh_ZHrBUFpw5Ft_IzNU20QAJav
;; minter of st-ton
st_ton=EQDNhy-nxYFgUqzfUzImBEP67JqsyMIcyk2S5_RwNNEYku0k
```

### 4. Sign in for deployment

before this section, we should complete previous sections.

```
$ npx blueprint run
```

we may get output like following:

```
? Choose file to use (Use arrow keys)
> deployStrategyJettonLSTTon
  deployStrategyTon
  deployUtonicManager
  setStrategyJettonLSTWallet
```

select `deployUtonicManager`, and we may get output like following:

```
? Choose file to use
? Choose file to use deployUtonicManager
? Which network do you want to use? (Use arrow keys)
> mainnet
  testnet
  custom
```

here we deploy contracts on mainnet (endpoint of ton testnet may have problems), select `mainnet` and we may get following output:

```
? Choose file to use
? Choose file to use deployUtonicManager
? Which network do you want to use? (Use arrow keys)
? Which network do you want to use? mainnet
? Which wallet are you using? (Use arrow keys)
> TON Connect compatible mobile wallet (example: Tonkeeper)
  Create a ton:// deep link
  Tonhub wallet
  Mnemonic
```

in this example, we select first option and then select `Tonkeeper`, then we can get a qr-code and a url link.

We copy the link and open it in your chrome, And click button `Sign in with Tonkeeper` and click `connect` button in the pop up window of `Tonkeeper`.

Now we have complete `sign-in`.

If you want to sign in with another wallet, just simply remove `temp/` directory.


### 5. deploy utonic manager

before this section, we should complete previous sections.

```
$ npx blueprint run
```

Then select as following options:

```
deployUtonicManager -> 
mainnet ->
TON Connect compatible mobile wallet (example: Tonkeeper) ->
Tonkeeper
```

and in the last section `Sign in for deployment`, we have already deployed utonic manager in fact, and we may get output like following:

```
Connected to wallet at address: EQCR3siASIbWlXKoUnMs5GoRSXkez084WrkRcDs8GKlMX-Zg
contract address: EQAreoiAIlPr_QHB3X_TfHSuP9sv1pWUyZzqbQnw_ZmSx19u
Counter already deployed
```

in this example, the address we deployed is `EQAreoiAIlPr_QHB3X_TfHSuP9sv1pWUyZzqbQnw_ZmSx19u`.

if some error occurred during steps above, just simply rerun the corresponding script.

### 6. deploy strategy ton

fill the `utonic_manager` parameter in `config.ini`:

```
utonic_manger=EQAreoiAIlPr_QHB3X_TfHSuP9sv1pWUyZzqbQnw_ZmSx19u
```

then, run script to deploy strategy ton

```
$ npx blueprint run
```

select following options:
```
deployStrategyTon -> 
mainnet ->
TON Connect compatible mobile wallet (example: Tonkeeper) ->
Tonkeeper
```

and we may get output like following:

```
Connected to wallet at address: EQCR3siASIbWlXKoUnMs5GoRSXkez084WrkRcDs8GKlMX-Zg
contract address: EQBbLOfTEnBLKilUfdPk6KY3LabwBLgUZvNsoEuoqPrhnZ08
waiting for deploy transaction to confirm...
waiting for deploy transaction to confirm...
waiting for deploy transaction to confirm...
waiting for deploy transaction to confirm...
waiting for deploy transaction to confirm...
deploy transaction confirmed!
```

in this example, the contract address is `EQBbLOfTEnBLKilUfdPk6KY3LabwBLgUZvNsoEuoqPrhnZ08`.
script.

### 7. deploy strategy jetton

fill the `utonic_manager` parameter in `config.ini`:

```
utonic_manger=EQAreoiAIlPr_QHB3X_TfHSuP9sv1pWUyZzqbQnw_ZmSx19u
```

then, run script to deploy strategy ton

```
$ npx blueprint run
```

select following options:
```
deployStrategyJettonLSTTon -> 
mainnet ->
TON Connect compatible mobile wallet (example: Tonkeeper) ->
Tonkeeper
```

and we may get output like following:

```
Connected to wallet at address: EQCR3siASIbWlXKoUnMs5GoRSXkez084WrkRcDs8GKlMX-Zg
contract address: EQBpsHOUcU2c-KnEfs_J75nOtz7pOHg_p9LHyS9ziMHrdzkH
waiting for deploy transaction to confirm...
waiting for deploy transaction to confirm...
waiting for deploy transaction to confirm...
waiting for deploy transaction to confirm...
waiting for deploy transaction to confirm...
deploy transaction confirmed!
```

in this example, the contract address is `EQBpsHOUcU2c-KnEfs_J75nOtz7pOHg_p9LHyS9ziMHrdzkH`.

### 8. set jetton wallet address

here, we will set `ts-ton` wallet for newly deployed `strategy-jetton`.

fill following parameters in config.ini:

```
;; fill before setting jetton wallet of strategy-jetton
strategy_lstton=EQBpsHOUcU2c-KnEfs_J75nOtz7pOHg_p9LHyS9ziMHrdzkH

;; fill before setting jetton wallet of strategy-jetton
lstton_jetton=ts_ton

;; minter of ts-ton
ts_ton=EQC98_qAmNEptUtPc7W6xdHh_ZHrBUFpw5Ft_IzNU20QAJav
;; minter of st-ton
st_ton=EQDNhy-nxYFgUqzfUzImBEP67JqsyMIcyk2S5_RwNNEYku0k
```

then select options as following:

```
setStrategyJettonLSTWallet ->
mainnet ->
TON Connect compatible mobile wallet (example: Tonkeeper) ->
Tonkeeper
```

and we may get output like following:

```
Connected to wallet at address: EQCR3siASIbWlXKoUnMs5GoRSXkez084WrkRcDs8GKlMX-Zg
wallet address:  EQBiv6qqInmpYOyRTraiCqSpvGpn0QSeiNQajsHMTDfs3j-R
waiting for transaction to confirm...
transaction confirmed!
```

this means we have successfully set the wallet for strategy jetton