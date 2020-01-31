import UndClient from "../src"
import { checkNumber } from "../src/utils/validateHelper"
import * as crypto from "../src/crypto"

/* make sure the address from the mnemonic has balances, or the case will failed */
const mnemonic =
  "chalk critic click web shove almost day oven awkward husband evoke switch margin judge bread notice envelope remove multiply employ december fatal wisdom rain"

const keystores = {
  // keystore with sha3 mac
  new: {
    version: 1,
    id: "406b55c6-1ec5-410e-b896-371966e92002",
    crypto: {
      ciphertext: "777a62eaccc8acbb22766057c58f162d9b4f5c68a9bb7673626445ed4f480506",
      cipherparams: {"iv":"bd366ef29292140851c0fab07563d471"},
      cipher: "aes-256-ctr",
      kdf: "pbkdf2",
      kdfparams: {
        dklen:32,
        salt: "bf06d1eb91253d1a2d8cba9bfebd39fe1554aa85ac5bd9ce8c8867c11e49ba0f",
        c:262144,
        prf: "hmac-sha256"
      },
      mac: "268a8de77b1a0b80252d5684c7e2b472fb9beaf01cb0eab88a55ec219311aedf8850a5b51089e58570a556f6468b6816bc533b3b20e287db8e5785aa15948fb5"}
  },
  // keystore with bad mac
  badMac: {
    version: 1,
    id: "406b55c6-1ec5-410e-b896-371966e92002",
    crypto: {
      ciphertext: "777a62eaccc8acbb22766057c58f162d9b4f5c68a9bb7673626445ed4f480506",
      cipherparams: {"iv":"bd366ef29292140851c0fab07563d471"},
      cipher: "aes-256-ctr",
      kdf: "pbkdf2",
      kdfparams: {
        dklen:32,
        salt: "bf06d1eb91253d1a2d8cba9bfebd39fe1554aa85ac5bd9ce8c8867c11e49ba0f",
        c:262144,
        prf: "hmac-sha256"
      },
      mac: "x7cc301d18c97c71741492b8029544952ad5567a733971deb49fd3eb03ee696e"
    }
  }
}

const targetAddress = "und150xrwj6ca9kyzz20e4x0qj6zm0206jhe4tk7nf"
const delAddress = "und1x8pl6wzqf9atkm77ymc5vn5dnpl5xytmn200xy"
const valAddress = "undvaloper1eq239sgefyzm4crl85nfyvt7kw83vrna6lrjet"
const redelValAddress = "undvaloper13lyhcfekkdczaugqaexya60ckn23l5wazf07px"
let testTxHash = ''

const wait = ms => {
  return new Promise(function(resolve) {
    setTimeout(function() {
      resolve()
    }, ms)
  })
}

const getClient = async (
  useAwaitSetPrivateKey = true,
  doNotSetPrivateKey = false
) => {
  const client = new UndClient("http://localhost:1317")
  await client.initChain()
  client.setBroadcastMode("block")
  const privateKey = crypto.getPrivateKeyFromMnemonic(mnemonic)
  if (!doNotSetPrivateKey) {
    if (useAwaitSetPrivateKey) {
      await client.setPrivateKey(privateKey)
    } else {
      client.setPrivateKey(privateKey) // test without `await`
    }
  }
  // use default delegates (signing, broadcast)
  client.useDefaultSigningDelegate()
  client.useDefaultBroadcastDelegate()
  return client
}

it("ensures that the number is positive", async () => {
  expect(() => checkNumber(-100, "-100")).toThrowError(
    "-100 should be a positive number"
  )
})

it("ensures that the number is less than 2^63", async () => {
  expect(() => checkNumber(Math.pow(2, 63), "2^63")).toThrowError(
    "2^63 should be less than 2^63"
  )
  expect(() => checkNumber(Math.pow(2, 63) + 1, "2^63")).toThrowError(
    "2^63 should be less than 2^63"
  )
})

beforeEach(() => {
  jest.setTimeout(50000)
})

it("create account", async () => {
  const client = await getClient(false)
  const res = client.createAccount()
  expect(res.address).toBeTruthy()
  expect(res.privateKey).toBeTruthy()
})

it("create account with keystore", async () => {
  const client = await getClient(false, true)
  const res = client.createAccountWithKeystore("12345678")
  expect(res.address).toBeTruthy()
  expect(res.privateKey).toBeTruthy()
  expect(res.keystore).toBeTruthy()
})

it("create account with mneomnic", async () => {
  const client = await getClient(false)
  const res = client.createAccountWithMneomnic()
  expect(res.address).toBeTruthy()
  expect(res.privateKey).toBeTruthy()
  expect(res.mnemonic).toBeTruthy()
})

it("recover account from keystore", async () => {
  const client = await getClient(false, true)
  const res = client.recoverAccountFromKeystore(keystores.new, "12345678")
  expect(res.address).toBeTruthy()
  expect(res.privateKey).toBeTruthy()
})

it("recover account from bad mac keystore", async () => {
  const client = await getClient(false, true)
  expect(() => {
    client.recoverAccountFromKeystore(keystores.badMac, "12345qwert!S")
  }).toThrowError()
})

it("recover account from mneomnic", async () => {
  jest.setTimeout(50000)
  const client = await getClient(false)
  const res = client.recoverAccountFromMnemonic(mnemonic)
  await 1500
  expect(res.address).toBeTruthy()
  expect(res.privateKey).toBeTruthy()
})

it("recover account from privatekey", async () => {
  jest.setTimeout(50000)
  const client = await getClient(false)
  const pk = crypto.generatePrivateKey()
  const res = client.recoverAccountFromPrivateKey(pk)
  await 1500
  expect(res.address).toBeTruthy()
  expect(res.privateKey).toBeTruthy()
})

it("get balance", async () => {
  const client = await getClient(false)
  const res = await client.getBalance(targetAddress)
  expect(res.length).toBeGreaterThanOrEqual(0)
})

it("transfer nund", async () => {
  jest.setTimeout(30000)

  const coin = "nund"
  let amount = 2001770112
  const client = await getClient(false)
  
  const addr = crypto.getAddressFromPrivateKey(client.privateKey)
  const account = await client._httpClient.request(
    "get",
    `/auth/accounts/${addr}`
  )

  let fee = {
    "amount": [
      {
        "denom": "nund",
        "amount": "2500"
      }
    ],
    "gas": "90000"
  }

  const sequence = account.result && account.result.result.account.value.sequence
  const res = await client.transferUnd(
    targetAddress,
    amount,
    fee,
    coin,
    addr,
    "hello world",
    sequence
  )
  expect(res.status).toBe(200)

  const hash = res.result.txhash
  testTxHash = hash
  const res2 = await client.getTx(hash)
  const sendAmount =
    res2.result.tx.value.msg[0].value.amount[0].amount
  expect(parseInt(sendAmount)).toBe(amount)
})

it("transfer und with presicion", async () => {
  jest.setTimeout(30000)

  const coin = "und"
  let amount = 2.001770112
  const client = await getClient(false)
  
  const addr = crypto.getAddressFromPrivateKey(client.privateKey)
  const account = await client._httpClient.request(
    "get",
    `/auth/accounts/${addr}`
  )

  let fee = {
    "amount": [
      {
        "denom": "nund",
        "amount": "2500"
      }
    ],
    "gas": "90000"
  }

  const sequence = account.result && account.result.result.account.value.sequence
  const res = await client.transferUnd(
    targetAddress,
    amount,
    fee,
    coin,
    addr,
    "hello world",
    sequence
  )
  expect(res.status).toBe(200)

  const hash = res.result.txhash
  const res2 = await client.getTx(hash)
  const sendAmount =
    res2.result.tx.value.msg[0].value.amount[0].amount
  expect(parseInt(sendAmount)).toBe(2001770112)
})

it("raise nund enterprise purchase order", async () => {
  jest.setTimeout(30000)

  const coin = "nund"
  let amount = 2001770112
  const client = await getClient(false)
  
  const addr = crypto.getAddressFromPrivateKey(client.privateKey)
  const account = await client._httpClient.request(
    "get",
    `/auth/accounts/${addr}`
  )

  let fee = {
    "amount": [
      {
        "denom": "nund",
        "amount": "2500"
      }
    ],
    "gas": "90000"
  }

  const sequence = account.result && account.result.result.account.value.sequence
  const res = await client.raiseEnterprisePO(
    amount,
    fee,
    coin,
    addr,
    "po evidence",
    sequence
  )
  expect(res.status).toBe(200)

  const hash = res.result.txhash
  const res2 = await client.getTx(hash)
  const sendAmount =
    res2.result.tx.value.msg[0].value.amount.amount
  expect(parseInt(sendAmount)).toBe(2001770112)
})

it("get enteprise locked und", async () => {
  const client = await getClient(false)
  const res = await client.getEnterpriseLocked(targetAddress)
  expect(res).toHaveProperty("amount")
  expect(res).toHaveProperty("denom")
})

it("delegate und", async () => {
  jest.setTimeout(30000)

  const coin = "nund"
  let amount = 2001770112
  const client = await getClient(false)
  
  const addr = crypto.getAddressFromPrivateKey(client.privateKey)
  const account = await client._httpClient.request(
    "get",
    `/auth/accounts/${addr}`
  )

  let fee = {
    "amount": [
      {
        "denom": "nund",
        "amount": "4872"
      }
    ],
    "gas": "194680"
  }

  const sequence = account.result && account.result.result.account.value.sequence
  const res = await client.delegate(
    valAddress,
    amount,
    fee,
    coin,
    addr,
    "delegate",
    sequence
  )

  expect(res.status).toBe(200)

  const hash = res.result.txhash
  const res2 = await client.getTx(hash)
  const sendAmount =
    res2.result.tx.value.msg[0].value.amount.amount
  expect(parseInt(sendAmount)).toBe(2001770112)
})

it("undelegate und", async () => {
  jest.setTimeout(30000)

  const coin = "nund"
  let amount = 10000
  const client = await getClient(false)
  
  const addr = crypto.getAddressFromPrivateKey(client.privateKey)
  const account = await client._httpClient.request(
    "get",
    `/auth/accounts/${addr}`
  )

  let fee = {
    "amount": [
      {
        "denom": "nund",
        "amount": "4872"
      }
    ],
    "gas": "194680"
  }

  const sequence = account.result && account.result.result.account.value.sequence
  const res = await client.undelegate(
    valAddress,
    amount,
    fee,
    coin,
    addr,
    "undelegate",
    sequence
  )

  expect(res.status).toBe(200)

  const hash = res.result.txhash
  const res2 = await client.getTx(hash)
  const sendAmount =
    res2.result.tx.value.msg[0].value.amount.amount
  expect(parseInt(sendAmount)).toBe(10000)
})

it("redelegate und", async () => {
  jest.setTimeout(30000)

  const coin = "nund"
  let amount = 1000
  const client = await getClient(false)
  
  const addr = crypto.getAddressFromPrivateKey(client.privateKey)
  const account = await client._httpClient.request(
    "get",
    `/auth/accounts/${addr}`
  )

  let fee = {
    "amount": [
      {
        "denom": "nund",
        "amount": "8105"
      }
    ],
    "gas": "324177"
  }

  const sequence = account.result && account.result.result.account.value.sequence
  const res = await client.redelegate(
    valAddress,
    redelValAddress,
    amount,
    fee,
    coin,
    addr,
    "",
    sequence
  )

  expect(res.status).toBe(200)

  const hash = res.result.txhash
  const res2 = await client.getTx(hash)
  expect(res2.result.logs[0].events[1].type).toBe("redelegate")
})

it("withdraw delegation rewards", async () => {
  const client = await getClient(false)
  
  const addr = crypto.getAddressFromPrivateKey(client.privateKey)
  const account = await client._httpClient.request(
    "get",
    `/auth/accounts/${addr}`
  )

  let fee = {
    "amount": [
      {
        "denom": "nund",
        "amount": "4872"
      }
    ],
    "gas": "194680"
  }

  const sequence = account.result && account.result.result.account.value.sequence
  const res = await client.withdrawDelegationReward(
    valAddress,
    fee,
    addr,
    "withdraw",
    sequence
  )

  expect(res.status).toBe(200)

  const hash = res.result.txhash
  const res2 = await client.getTx(hash)
  expect(res2.result.logs[0].events[1].type).toBe("transfer")
})

it("modify delegation withdraw address", async () => {
  const client = await getClient(false)
  
  const addr = crypto.getAddressFromPrivateKey(client.privateKey)
  const account = await client._httpClient.request(
    "get",
    `/auth/accounts/${addr}`
  )

  let fee = {
    "amount": [
      {
        "denom": "nund",
        "amount": "8105"
      }
    ],
    "gas": "324177"
  }

  const sequence = account.result && account.result.result.account.value.sequence
  const res = await client.modifyWithdrawAddress(
    targetAddress,
    fee,
    addr,
    "modify",
    sequence
  )

  expect(res.status).toBe(200)

  const hash = res.result.txhash
  const res2 = await client.getTx(hash)
  expect(res2.result.logs[0].events[1].type).toBe("set_withdraw_address")
})

it("get account", async () => {
  const client = await getClient(false)

  const res = await client.getAccount(targetAddress)
  if (res.status === 200) {
    expect(res.status).toBe(200)
  } else {
    expect(res.status).toBe(204)
  }
})

it("get balance no arg", async () => {
  const client = await getClient(false)
  const balances = await client.getBalance()
  expect(balances.length).toBeGreaterThan(0)
})

it("get transactions works", async () => {
  const client = await getClient(false)
  const { result: transactions, status } = await client.getTransactions(
    targetAddress
  )
  expect(status).toBe(200)
  expect(transactions).toHaveProperty("txs")
  expect(transactions).toHaveProperty("total_count")
})

it("get transactions received works", async () => {
  const client = await getClient(false)
  const { result: transactions, status } = await client.getTransactionsReceived(
    targetAddress
  )
  expect(status).toBe(200)
  expect(transactions).toHaveProperty("txs")
  expect(transactions).toHaveProperty("total_count")
})

it("get tx works", async () => {

  const client = await getClient(false)
  const { result: tx, status } = await client.getTx(testTxHash)
  expect(status).toBe(200)
  expect(tx).toHaveProperty("gas_used")
  expect(tx).toHaveProperty("gas_wanted")
  expect(tx).toHaveProperty("height")
  expect(tx).toHaveProperty("logs")
  expect(tx).toHaveProperty("raw_log")
  expect(tx).toHaveProperty("timestamp")
  expect(tx).toHaveProperty("tx")
  expect(tx).toHaveProperty("txhash")
})

it("test get enterprise purchase orders works", async () => {
  const client = await getClient(false)
  const addr = crypto.getAddressFromPrivateKey(client.privateKey) // must be same as addr used in raise PO test
  const { result: pos, status } = await client.getEnteprisePos(
    addr
  )
  expect(status).toBe(200)
  expect(pos.result[0]).toHaveProperty("id")
  expect(pos.result[0]).toHaveProperty("purchaser")
  expect(pos.result[0]).toHaveProperty("amount")
  expect(pos.result[0]).toHaveProperty("status")
  expect(pos.result[0]).toHaveProperty("raise_time")
  expect(pos.result[0]).toHaveProperty("decisions")
  expect(pos.result[0]).toHaveProperty("completion_time")
})

it("test get delegations works", async () => {
  const client = await getClient(false)
  const addr = crypto.getAddressFromPrivateKey(client.privateKey) // must be same as addr used in delegation test
  const { result: pos, status } = await client.getDelegations(
    addr
  )
  expect(status).toBe(200)
  expect(pos.result[0]).toHaveProperty("delegator_address")
  expect(pos.result[0]).toHaveProperty("validator_address")
  expect(pos.result[0]).toHaveProperty("shares")
  expect(pos.result[0]).toHaveProperty("balance")
})

it("test get unbonding delegations works", async () => {
  const client = await getClient(false)
  const addr = crypto.getAddressFromPrivateKey(client.privateKey) // must be same as addr used in unbonding test
  const { result: pos, status } = await client.getUnbondingDelegations(
    addr
  )
  expect(status).toBe(200)
  expect(pos.result[0]).toHaveProperty("delegator_address")
  expect(pos.result[0]).toHaveProperty("validator_address")
  expect(pos.result[0]).toHaveProperty("entries")
})

it("test get bonded validators works", async () => {
  const client = await getClient(false)
  const addr = crypto.getAddressFromPrivateKey(client.privateKey) // must be same as addr used in delegation test
  const { result: pos, status } = await client.getBondedValidators(
    addr
  )
  expect(status).toBe(200)
  expect(pos.result[0]).toHaveProperty("operator_address")
  expect(pos.result[0]).toHaveProperty("consensus_pubkey")
})

it("test get delegations for val address works", async () => {
  const client = await getClient(false)
  const addr = crypto.getAddressFromPrivateKey(client.privateKey) // must be same as addr used in delegation test
  const { result: pos, status } = await client.getDelegations(
    addr, valAddress
  )
  expect(status).toBe(200)
  expect(pos.result).toHaveProperty("delegator_address")
  expect(pos.result).toHaveProperty("validator_address")
  expect(pos.result).toHaveProperty("shares")
  expect(pos.result).toHaveProperty("balance")
})

it("test get unbonding delegations with val address works", async () => {
  const client = await getClient(false)
  const addr = crypto.getAddressFromPrivateKey(client.privateKey) // must be same as addr used in unbonding test
  const { result: pos, status } = await client.getUnbondingDelegations(
    addr, valAddress
  )
  expect(status).toBe(200)
  expect(pos.result).toHaveProperty("delegator_address")
  expect(pos.result).toHaveProperty("validator_address")
  expect(pos.result).toHaveProperty("entries")
})

it("test get bonded validators with val address works", async () => {
  const client = await getClient(false)
  const addr = crypto.getAddressFromPrivateKey(client.privateKey) // must be same as addr used in delegation test
  const { result: pos, status } = await client.getBondedValidators(
    addr, valAddress
  )
  expect(status).toBe(200)
  expect(pos.result).toHaveProperty("operator_address")
  expect(pos.result).toHaveProperty("consensus_pubkey")
})

it("test get delegator rewards", async () => {
  const client = await getClient(false)
  const addr = crypto.getAddressFromPrivateKey(client.privateKey) // must be same as addr used in delegation test
  const { result: pos, status } = await client.getDelegatorRewards(
    addr
  )
  expect(status).toBe(200)
  expect(pos.result.rewards[0]).toHaveProperty("validator_address")
  expect(pos.result.rewards[0]).toHaveProperty("reward")
})

it("test get delegator rewards with val address", async () => {
  const client = await getClient(false)
  const addr = crypto.getAddressFromPrivateKey(client.privateKey) // must be same as addr used in delegation test
  const { result: pos, status } = await client.getDelegatorRewards(
    addr, valAddress
  )
  expect(status).toBe(200)
  expect(pos.result[0]).toHaveProperty("amount")
  expect(pos.result[0]).toHaveProperty("denom")
})

it("test get delegator withdraw address", async () => {
  const client = await getClient(false)
  const addr = crypto.getAddressFromPrivateKey(client.privateKey) // must be same as addr used in delegation test
  const { result: pos, status } = await client.getDelegatorWithdrawAddress(
    addr
  )
  expect(status).toBe(200)
  expect(pos.result).toBe(targetAddress)
})

it("test get validators works", async () => {
  const client = await getClient(false)
  const { result: pos, status } = await client.getValidators()
  expect(status).toBe(200)
  expect(pos.result[0]).toHaveProperty("operator_address")
  expect(pos.result[0]).toHaveProperty("consensus_pubkey")
})

it("test get validator's bonded delegations works", async () => {
  const client = await getClient(false)
  const { result: pos, status } = await client.getValidatorDelegations(valAddress)
  expect(status).toBe(200)
  expect(pos.result[0]).toHaveProperty("delegator_address")
  expect(pos.result[0]).toHaveProperty("validator_address")
  expect(pos.result[0]).toHaveProperty("shares")
  expect(pos.result[0]).toHaveProperty("balance")
})

it("test get validator's unbonding delegations works", async () => {
  const client = await getClient(false)
  const { result: pos, status } = await client.getValidatorUnbondingDelegations(valAddress)
  expect(status).toBe(200)
  expect(pos.result[0]).toHaveProperty("delegator_address")
  expect(pos.result[0]).toHaveProperty("validator_address")
  expect(pos.result[0]).toHaveProperty("entries")
})

it("test get validator's redelegations works", async () => {
  const client = await getClient(false)
  const addr = crypto.getAddressFromPrivateKey(client.privateKey)
  const { result: pos, status } = await client.getRedelegations(addr, valAddress, redelValAddress)
  expect(status).toBe(200)
  expect(pos.result[0]).toHaveProperty("delegator_address")
  expect(pos.result[0]).toHaveProperty("validator_src_address")
  expect(pos.result[0]).toHaveProperty("validator_dst_address")
  expect(pos.result[0]).toHaveProperty("entries")
})

it("test get validator's distribution info", async () => {
  const client = await getClient(false)
  const { result: pos, status } = await client.getValidatorDistributionInfo(valAddress)
  expect(status).toBe(200)
  expect(pos.result).toHaveProperty("operator_address")
  expect(pos.result).toHaveProperty("self_bond_rewards")
})

it("test get validator's distribution outstanding rewards", async () => {
  const client = await getClient(false)
  const { result: pos, status } = await client.getValidatorDistributionOutstandingRewards(valAddress)
  expect(status).toBe(200)
  expect(pos.result[0]).toHaveProperty("amount")
  expect(pos.result[0]).toHaveProperty("denom")
})

it("test get validator's distribution rewards", async () => {
  const client = await getClient(false)
  const { result: pos, status } = await client.getValidatorDistributionRewards(valAddress)
  expect(status).toBe(200)
  expect(pos.result[0]).toHaveProperty("amount")
  expect(pos.result[0]).toHaveProperty("denom")
})

it("test get total supply", async () => {
  const client = await getClient(false)
  const { result: pos, status } = await client.getTotalSupply()
  expect(status).toBe(200)
  expect(pos.result).toHaveProperty("amount")
  expect(pos.result).toHaveProperty("denom")
  expect(pos.result).toHaveProperty("locked")
  expect(pos.result).toHaveProperty("total")
})

it("check number when transfer", async () => {
  const client = await getClient(true)
  const addr = crypto.getAddressFromPrivateKey(client.privateKey)

  const account = await client._httpClient.request(
    "get",
    `/auth/accounts/${addr}`
  )
  const sequence = account.result && account.result.result.account.value.sequence

  let fee = {
    "amount": [
      {
        "denom": "nund",
        "amount": "2500"
      }
    ],
    "gas": "90000"
  }

  try {
    await client.transferUnd(
      targetAddress,
      -1,
      fee,
      "nund",
      addr,
      "hello world",
      sequence
    )
  } catch (err) {
    expect(err.message).toBe("amount should be a positive number")
  }

  try {
    await client.transferUnd(
      targetAddress,
      Math.pow(2, 63),
      fee,
      "nund",
      addr,
      "hello world",
      sequence
    )
  } catch (err) {
    expect(err.message).toBe("amount should be less than 2^63")
  }
})

it("test get filtered txs with no filter should fail", async () => {
  const client = await getClient(false)
  const  { result: res, status } = await client.getFilteredTransactions()
  expect(status).toBe(400)
  expect(res.error).toBe("getFilteredTransactions error: must include at least one filter passed as an array")
})

it("test get filtered txs with filter", async () => {
  const client = await getClient(false)

  let filters = [
    {
      'key': 'message.sender',
      'val': 'und1x8pl6wzqf9atkm77ymc5vn5dnpl5xytmn200xy'
    },
    {
      'key': 'message.action',
      'val': 'raise_enterprise_purchase_order'
    },
  ]

  const { result: transactions, status } = await client.getFilteredTransactions(filters)
  expect(status).toBe(200)
  expect(transactions).toHaveProperty("txs")
  expect(transactions).toHaveProperty("total_count")
})

it("test get filtered txs with rubbish filter", async () => {
  const client = await getClient(false)

  let filters = [
    {
      'key': 'mesge.sendr',
      'val': 'und1x8pl6wzqf9atkm77ymc5vn5dnpl5xytmn200xy'
    },
    {
      'key': 'not.valid.filter',
      'val': 'raise_enterprise_purchase_order'
    },
  ]

  const { result: transactions, status } = await client.getFilteredTransactions(filters)
  expect(status).toBe(200)
  expect(transactions).toHaveProperty("txs")
  expect(transactions).toHaveProperty("total_count")
  expect(transactions.total_count).toBe('0')
})
