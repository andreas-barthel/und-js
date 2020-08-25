import UndClient from "../src"
import TransportNodeHid from "@ledgerhq/hw-transport-node-hid"

// Ledger Test Mnemonic: equip will roof matter pink blind book anxiety banner elbow sun young

// Ensure this address has FUND on DevNet and DevNet is running, or tests will fail
const ledgerAddress = "und1nkcrcf4ymjq4j9rdmuhturgn3c23lr90kxxwkj" // adddress for 44'/5555'/0'/0/0 (account 0)

const toAddress = "und150xrwj6ca9kyzz20e4x0qj6zm0206jhe4tk7nf"
let client = null

const wait = ms => {
  return new Promise(function(resolve) {
    setTimeout(function() {
      resolve()
    }, ms)
  })
}

const getLedgerClient = async(acc) => {
  if(!client) {
    client = new UndClient("http://localhost:1318")
    await client.initChain()
    client.setBroadcastMode("block")

    try {
      let ts = await TransportNodeHid.open("")
      await client.useLedgerSigningDelegate(acc, ts)
    } catch (e) {
      console.log(e.toString())
      return null
    }
  }
  return client
}

it("check address for 44'/5555'/0'/0/0", async () => {
  let client = await getLedgerClient(0)
  expect(client).toBeTruthy()
  expect(client.address).toBe(ledgerAddress)
})

it("transfer nund with Ledger app", async () => {
  jest.setTimeout(30000)

  const coin = "nund"
  let amount = 2001770112
  const client = await getLedgerClient(0)
  expect(client).toBeTruthy()

  let fee = {
    "amount": [
      {
        "denom": "nund",
        "amount": "25000"
      }
    ],
    "gas": "90000"
  }

  const res = await client.transferUnd(
    toAddress,
    amount,
    fee,
    coin,
    client.address,
    "Ledger Test"
  )
  expect(res.status).toBe(200)

  const hash = res.result.txhash
  const res2 = await client.getTx(hash)
  const sendAmount =
    res2.result.tx.value.msg[0].value.amount[0].amount
  expect(parseInt(sendAmount)).toBe(amount)

  await wait(1000)
})
