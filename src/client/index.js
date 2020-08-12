/**
 * @module client
 */
import * as crypto from "../crypto"
import HttpRequest from "../utils/request"
import GenMsg from "../msg"
import Transaction from "../tx"
import { checkNumber } from "../utils/validateHelper"
import { checkBroadcastMode, getUsbTransport, reParseLedgerError } from "../utils"
import CosmosApp from "ledger-cosmos-js"

const CONFIG = require("../config")

/**
 * The default signing delegate which uses the local private key.
 * @param  {Transaction} tx      the transaction
 * @param  {Object}      signMsg the canonical sign bytes for the msg
 * @return {Transaction}
 */
export const DefaultSigningDelegate = async function (tx) {
  return tx.sign(this.privateKey)
}

/**
 * The Ledger signing delegate which uses the Ledger app over USB.
 * @param  {Transaction} tx      the transaction
 * @return {Transaction}
 */
export const LedgerSigningDelegate = async function (tx) {
  return tx.signLedger(this._ledgerAccount, this._ledgerTransport)
}

/**
 * The default broadcast delegate which immediately broadcasts a transaction.
 * @param {Transaction} signedTx the signed transaction
 */
export const DefaultBroadcastDelegate = async function (signedTx) {
  return this.sendTransaction(signedTx)
}

/**
 * The und Mainchain client.
 */
export class UndClient {
  /**
   * @param {String} server und Mainchain public url
   * @param {String} broadcastMode sync = wait for checkTx, async = send and forget (faster but less guarantees), block = wait for block to process (default sync)
   */
  constructor(server, broadcastMode = "sync") {
    if (!server) {
      throw new Error("und Mainchain server should not be null")
    }
    this._httpClient = new HttpRequest(server)
    this._signingDelegate = DefaultSigningDelegate
    this._broadcastDelegate = DefaultBroadcastDelegate
    this._broadcastMode = checkBroadcastMode(broadcastMode)
    let path =  [...CONFIG.HD_PATH_ARR]
    path.push(0)
    this._ledgerAccount = path
    this._ledgerTransport = "WebUSB"

    this.isLedgerMode = false
  }

  /**
   * Initialize the client with the chain's ID. Asynchronous.
   * @return {Promise}
   */
  async initChain() {
    if (!this.chainId) {
      const data = await this._httpClient.request("get", CONFIG.API_NODE_INFO)
      this.chainId = data.result.node_info && data.result.node_info.network
      this.node_info = data.result.node_info
      this.node_app_version = data.result.application_version
    }
    return this
  }

  /**
   * Sets the client's private key for calls made by this client. Asynchronous.
   * @param {string} privateKey the private key hexstring
   * @param {boolean} localOnly set this to true if you will supply an account_number yourself via `setAccountNumber`. Warning: You must do that if you set this to true!
   * @return {Promise}
   */
  async setPrivateKey(privateKey, localOnly = false) {
    if (privateKey !== this.privateKey) {
      const address = crypto.getAddressFromPrivateKey(privateKey, CONFIG.BECH32_PREFIX)
      if (!address) throw new Error(`address is falsy: ${address}. invalid private key?`)
      if (address === this.address) return this // safety
      this.privateKey = privateKey
      this.address = address
      if (!localOnly) {
        // _setPkPromise is used in _sendTransaction for non-await calls
        const promise = this._setPkPromise = this._httpClient.request("get", `${CONFIG.API_QUERY_ACCOUNT}/${address}`)
        const data = await promise
        this.account_number = data.result.result.account.value.account_number
      }
    }
    return this
  }

  /**
   * Set the mode for broadcasting a Tx
   * @param {String} broadcastMode sync = wait for checkTx, async = send and forget (faster but less guarantees), block = wait for block to process (default sync)
   */
  setBroadcastMode(broadcastMode) {
    this._broadcastMode = checkBroadcastMode(broadcastMode)
  }

  /**
   * Sets the client's account number.
   * @param {boolean} accountNumber
   */
  setAccountNumber(accountNumber) {
    this.account_number = accountNumber
  }

  /**
   * Sets the signing delegate (for wallet integrations).
   * @param {function} delegate
   * @param {boolean} ledgerMode
   * @return {UndClient} this instance (for chaining)
   */
  setSigningDelegate(delegate, ledgerMode = false) {
    if (typeof delegate !== "function") throw new Error("signing delegate must be a function")
    this._signingDelegate = delegate
    this.isLedgerMode = ledgerMode
    return this
  }

  /**
   * Sets the broadcast delegate (for wallet integrations).
   * @param {function} delegate
   * @return {UndClient} this instance (for chaining)
   */
  setBroadcastDelegate(delegate) {
    if (typeof delegate !== "function") throw new Error("broadcast delegate must be a function")
    this._broadcastDelegate = delegate
    return this
  }

  /**
   * Applies the default signing delegate.
   * @return {UndClient} this instance (for chaining)
   */
  useDefaultSigningDelegate() {
    this._signingDelegate = DefaultSigningDelegate
    this.isLedgerMode = false
    return this
  }

  /**
   * Applies the Ledger device signing delegate. Internally assigns the wallet
   * address used by the SDK to the respective HD wallet path's address.
   * For unit testing, the Node-HID transport can be passed instead of a string
   * @param {Number} acc
   * @param {String | Transport} ts
   * @param {boolean} localOnly
   * @return {UndClient} this instance (for chaining)
   */
  async useLedgerSigningDelegate(acc = 0, ts = "WebUSB", localOnly = false) {
    this._signingDelegate = LedgerSigningDelegate
    this.isLedgerMode = true
    let path = [...CONFIG.HD_PATH_ARR]
    path.push(acc)
    this._ledgerAccount = path
    this._ledgerTransport = ts

    let transport = null

    if(typeof ts === "string") {
      try {
        transport = await getUsbTransport(ts)
      } catch (e) {
        throw new Error(`error connecting to Ledger Device: ${e.toString()}`)
      }
    } else if(typeof ts === "object") {
      if(ts.constructor.name === "TransportNodeHid") {
        transport = ts
      }
    }

    if(!transport) {
      throw new Error("no transport method set")
    }

    const app = new CosmosApp(transport)

    let response = await app.getAddressAndPubKey(this._ledgerAccount, CONFIG.BECH32_PREFIX)
    if (response.return_code !== 0x9000) {
      response = reParseLedgerError(response)
      throw new Error(`Error [${response.return_code}] ${response.error_message}`)
    }

    this.address = response.bech32_address

    if (!localOnly) {
      // _setPkPromise is used in _sendTransaction for non-await calls
      const promise = this._setPkPromise = this._httpClient.request("get", `${CONFIG.API_QUERY_ACCOUNT}/${this.address}`)
      const data = await promise
      try {
        this.account_number = data.result.result.account.value.account_number
      } catch (e) {
        this.account_number = null
      }
    }

    return this
  }

  /**
   * Asks the user to view and confirm the wallet address on the Ledger device
   * that is currently being used by the SDK
   * @returns {Promise<*>} String containing bech32 address for external comparison
   */
  async confirmLedgerAddress() {
    if(!this.isLedgerMode) {
      throw new Error("und-js not in Ledger mode")
    }

    let transport = null

    try {
      transport = await getUsbTransport(this._ledgerTransport)
    } catch (e) {
      throw new Error(`error connecting to Ledger Device: ${e.toString()}`)
    }

    if(!transport) {
      throw new Error("no transport method set")
    }

    const app = new CosmosApp(transport)

    let response = await app.showAddressAndPubKey(this._ledgerAccount, CONFIG.BECH32_PREFIX)
    if (response.return_code !== 0x9000) {
      response = reParseLedgerError(response)
      throw new Error(`Error [${response.return_code}] ${response.error_message}`)
    }

    return response.bech32_address
  }

  /**
   * Applies the default broadcast delegate.
   * @return {UndClient} this instance (for chaining)
   */
  useDefaultBroadcastDelegate() {
    this._broadcastDelegate = DefaultBroadcastDelegate
    return this
  }

  /**
   * Transfer FUND to an address
   * @param {String} toAddress
   * @param {Number} amount
   * @param {Object} fee
   * @param {String} denom optional denom
   * @param {String} fromAddress optional fromAddress
   * @param {String} memo optional memo
   * @param {Number} sequence optional sequence
   * @returns {Promise<*>}
   */
  async transferUnd(toAddress, amount, fee, denom = "nund", fromAddress = this.address, memo = "", sequence = null) {
    if (!fromAddress) {
      throw new Error("fromAddress should not be empty")
    }
    if (!toAddress) {
      throw new Error("toAddress should not be empty")
    }
    if(amount === 0) {
      throw new Error("amount should not be zero")
    }
    if(!crypto.checkAddress(toAddress, CONFIG.BECH32_PREFIX)) {
      throw new Error("invalid toAddress")
    }
    if(!crypto.checkAddress(fromAddress, CONFIG.BECH32_PREFIX)) {
      throw new Error("invalid fromAddress")
    }

    checkNumber(amount, "amount")

    // generate MsgSend
    let msgData = {
      type: "MsgSend",
      from: fromAddress,
      to: toAddress,
      amount: amount,
      denom: denom
    }

    const sendMsg = new GenMsg(msgData)

    let signedTx = null
    try {
      signedTx = await this._prepareTx(sendMsg, fromAddress, fee, sequence, memo)
    } catch(e) {
      throw(e)
    }

    return this._broadcastDelegate(signedTx)
  }

  /**
   * Raise an Enterprise FUND Purchase Order
   * @param {Number} amount
   * @param {Object} fee
   * @param {String} denom optional denom
   * @param {String} fromAddress optional fromAddress
   * @param {String} memo optional memo
   * @param {Number} sequence optional sequence
   * @returns {Promise<*>}
   */
  async raiseEnterprisePO(amount, fee, denom = "nund", fromAddress = this.address, memo = "", sequence = null) {
    if (!fromAddress) {
      throw new Error("fromAddress should not be empty")
    }
    if(!crypto.checkAddress(fromAddress, CONFIG.BECH32_PREFIX)) {
      throw new Error("invalid fromAddress")
    }
    if(amount === 0) {
      throw new Error("amount should not be zero")
    }

    checkNumber(amount, "amount")

    // generate PurchaseUnd
    let msgData = {
      type: "PurchaseUnd",
      from: fromAddress,
      amount: amount,
      denom: denom
    }

    const sendMsg = new GenMsg(msgData)

    let signedTx = null
    try {
      signedTx = await this._prepareTx(sendMsg, fromAddress, fee, sequence, memo)
    } catch(e) {
      throw(e)
    }

    return this._broadcastDelegate(signedTx)
  }

  /**
   * Register a BEACON
   * @param moniker {String} moniker
   * @param name {String} name optional name
   * @param fromAddress {String} fromAddress
   * @param gas {Number} gas optional gas
   * @param memo {String} memo optional memo
   * @param sequence {Number} sequence optional sequence
   * @returns {Promise<*>}
   */
  async registerBeacon(moniker, name= "", fromAddress = this.address, gas = 100000, memo = "", sequence = null) {
    if (!fromAddress) {
      throw new Error("fromAddress should not be empty")
    }
    if(!crypto.checkAddress(fromAddress, CONFIG.BECH32_PREFIX)) {
      throw new Error("invalid fromAddress")
    }
    if(moniker === "" || moniker === null || moniker === undefined) {
      throw new Error("beacon must have a moniker")
    }
    let msgData = {
      type: "RegisterBeacon",
      moniker: moniker,
      name: name,
      owner: fromAddress
    }

    let params = await this.getBeaconParams()

    let fee = {
      amount: [
        {
          denom: "nund",
          amount: "10000000000000"
        }
      ],
      gas: gas.toString()
    }
    if("fee_register" in params.result.result) {
      fee.amount[0].amount = params.result.result.fee_register
      fee.amount[0].denom = params.result.result.denom
    }

    const sendMsg = new GenMsg(msgData)

    let signedTx = null
    try {
      signedTx = await this._prepareTx(sendMsg, fromAddress, fee, sequence, memo)
    } catch(e) {
      throw(e)
    }

    return this._broadcastDelegate(signedTx)
  }

  /**
   * Submit a BEACON timestamp
   * @param beacon_id {Number} beacon_id
   * @param hash {String} hash
   * @param submit_time {Number} submit_time
   * @param fromAddress {String} fromAddress
   * @param gas {Number} gas optional gas
   * @param memo {String} memo optional memo
   * @param sequence {Number} sequence optional sequence
   * @returns {Promise<*>}
   */
  async recordBeaconTimestamp(beacon_id, hash, submit_time, fromAddress = this.address, gas = 100000, memo = "", sequence = null) {
    if (!fromAddress) {
      throw new Error("fromAddress should not be empty")
    }
    if(!crypto.checkAddress(fromAddress, CONFIG.BECH32_PREFIX)) {
      throw new Error("invalid fromAddress")
    }

    if(parseInt(beacon_id) <= 0) {
      throw new Error("must have beacon id")
    }
    if(hash === "" || hash === null || hash === undefined) {
      throw new Error("beacon must have hash")
    }
    if(parseInt(submit_time) <= 0) {
      throw new Error("must have submit time")
    }
    let msgData = {
      type: "RecordBeaconTimestamp",
      beacon_id: beacon_id.toString(),
      hash: hash,
      submit_time: submit_time.toString(),
      owner: fromAddress
    }

    let params = await this.getBeaconParams()

    let fee = {
      amount: [
        {
          denom: "nund",
          amount: "1000000000"
        }
      ],
      gas: gas.toString()
    }
    if("fee_record" in params.result.result) {
      fee.amount[0].amount = params.result.result.fee_record
      fee.amount[0].denom = params.result.result.denom
    }

    const sendMsg = new GenMsg(msgData)

    let signedTx = null
    try {
      signedTx = await this._prepareTx(sendMsg, fromAddress, fee, sequence, memo)
    } catch(e) {
      throw(e)
    }

    return this._broadcastDelegate(signedTx)
  }

  /**
   * Register a WRKChain
   * @param moniker {String} moniker
   * @param base_type {String} base_type optional base_type
   * @param name {String} name optional name
   * @param genesis {String} genesis optional genesis
   * @param fromAddress {String} fromAddress
   * @param gas {Number} gas optional gas
   * @param memo {String} memo optional memo
   * @param sequence {Number} sequence optional sequence
   * @returns {Promise<*>}
   */
  async registerWRKChain(moniker, base_type, name= "", genesis= "", fromAddress = this.address, gas = 100000, memo = "", sequence = null) {
    if (!fromAddress) {
      throw new Error("fromAddress should not be empty")
    }
    if(!crypto.checkAddress(fromAddress, CONFIG.BECH32_PREFIX)) {
      throw new Error("invalid fromAddress")
    }
    if(moniker === "" || moniker === null || moniker === undefined) {
      throw new Error("wrkchain must have a moniker")
    }
    if(base_type === "" || base_type === null || base_type === undefined) {
      throw new Error("wrkchain must have a type")
    }
    let msgData = {
      type: "RegisterWrkChain",
      moniker: moniker,
      name: name,
      genesis: genesis,
      base_type: base_type,
      owner: fromAddress
    }

    let params = await this.getWRKChainParams()

    let fee = {
      amount: [
        {
          denom: "nund",
          amount: "10000000000000"
        }
      ],
      gas: gas.toString()
    }
    if("fee_register" in params.result.result) {
      fee.amount[0].amount = params.result.result.fee_register
      fee.amount[0].denom = params.result.result.denom
    }

    const sendMsg = new GenMsg(msgData)

    let signedTx = null
    try {
      signedTx = await this._prepareTx(sendMsg, fromAddress, fee, sequence, memo)
    } catch(e) {
      throw(e)
    }

    return this._broadcastDelegate(signedTx)
  }

  /**
   * Submit WRKChain block header hashes
   * @param wrkchain_id {Number} wrkchain_id
   * @param height {String} height
   * @param blockhash {String} blockhash
   * @param parenthash {String} parenthash optional parenthash
   * @param hash1 {String} hash1 optional hash1
   * @param hash2 {String} hash2 optional hash2
   * @param hash3 {String} hash3 optional hash3
   * @param fromAddress {String} fromAddress
   * @param gas {Number} gas optional gas
   * @param memo {String} memo optional memo
   * @param sequence {Number} sequence optional sequence
   * @returns {Promise<*>}
   */
  async recordWRKChainBlock(wrkchain_id, height, blockhash, parenthash, hash1, hash2, hash3, fromAddress = this.address, gas = 120000, memo = "", sequence = null) {
    if (!fromAddress) {
      throw new Error("fromAddress should not be empty")
    }
    if(!crypto.checkAddress(fromAddress, CONFIG.BECH32_PREFIX)) {
      throw new Error("invalid fromAddress")
    }

    if(parseInt(wrkchain_id) <= 0) {
      throw new Error("must have wrkchain id")
    }
    if(blockhash === "" || blockhash === null || blockhash === undefined) {
      throw new Error("wrkchain must have blockhash")
    }
    if(parseInt(height) <= 0) {
      throw new Error("must have height")
    }
    let msgData = {
      type: "RecordWrkChainBlock",
      wrkchain_id: wrkchain_id.toString(),
      height: height.toString(),
      blockhash: blockhash,
      parenthash: parenthash,
      hash1: hash1,
      hash2: hash2,
      hash3: hash3,
      owner: fromAddress
    }

    let params = await this.getWRKChainParams()

    let fee = {
      amount: [
        {
          denom: "nund",
          amount: "1000000000"
        }
      ],
      gas: gas.toString()
    }
    if("fee_record" in params.result.result) {
      fee.amount[0].amount = params.result.result.fee_record
      fee.amount[0].denom = params.result.result.denom
    }

    const sendMsg = new GenMsg(msgData)

    let signedTx = null
    try {
      signedTx = await this._prepareTx(sendMsg, fromAddress, fee, sequence, memo)
    } catch(e) {
      throw(e)
    }

    return this._broadcastDelegate(signedTx)
  }

  /**
   * Delegate FUND to a validator
   * @param {String} validator
   * @param {Number} amount
   * @param {Object} fee
   * @param {String} denom optional denom
   * @param {String} delegator optional delegator
   * @param {String} memo optional memo
   * @param {Number} sequence optional sequence
   * @returns {Promise<*>}
   */
  async delegate(validator, amount, fee, denom = "nund", delegator = this.address, memo = "", sequence = null) {
    if (!delegator) {
      throw new Error("delegator should not be empty")
    }
    if(!crypto.checkAddress(delegator, CONFIG.BECH32_PREFIX)) {
      throw new Error("invalid delegator")
    }
    if (!validator) {
      throw new Error("validator should not be empty")
    }
    if(!crypto.checkAddress(validator, CONFIG.BECH32_VAL_PREFIX)) {
      throw new Error("invalid validator")
    }
    if(amount === 0) {
      throw new Error("amount should not be zero")
    }

    checkNumber(amount, "amount")

    // generate MsgDelegate
    let msgData = {
      type: "MsgDelegate",
      delegator_address: delegator,
      validator_address: validator,
      amount: amount,
      denom: denom
    }

    const sendMsg = new GenMsg(msgData)

    let signedTx = null
    try {
      signedTx = await this._prepareTx(sendMsg, delegator, fee, sequence, memo)
    } catch(e) {
      throw(e)
    }

    return this._broadcastDelegate(signedTx)
  }

  /**
   * Undelegate FUND from a validator
   * @param {String} validator
   * @param {Number} amount
   * @param {Object} fee
   * @param {String} denom optional denom
   * @param {String} delegator optional delegator
   * @param {String} memo optional memo
   * @param {Number} sequence optional sequence
   * @returns {Promise<*>}
   */
  async undelegate(validator, amount, fee, denom = "nund", delegator = this.address, memo = "", sequence = null) {
    if (!delegator) {
      throw new Error("delegator should not be empty")
    }
    if(!crypto.checkAddress(delegator, CONFIG.BECH32_PREFIX)) {
      throw new Error("invalid delegator")
    }
    if (!validator) {
      throw new Error("validator should not be empty")
    }
    if(!crypto.checkAddress(validator, CONFIG.BECH32_VAL_PREFIX)) {
      throw new Error("invalid validator")
    }
    if(amount === 0) {
      throw new Error("amount should not be zero")
    }

    checkNumber(amount, "amount")

    // generate MsgUndelegate
    let msgData = {
      type: "MsgUndelegate",
      delegator_address: delegator,
      validator_address: validator,
      amount: amount,
      denom: denom
    }

    const sendMsg = new GenMsg(msgData)

    let signedTx = null
    try {
      signedTx = await this._prepareTx(sendMsg, delegator, fee, sequence, memo)
    } catch(e) {
      throw(e)
    }

    return this._broadcastDelegate(signedTx)
  }

  /**
   * Redelegate FUND from one validator to another
   * @param {String} validatorFrom
   * @param {String} validatorTo
   * @param {Number} amount
   * @param {Object} fee
   * @param {String} denom optional denom
   * @param {String} delegator optional delegator
   * @param {String} memo optional memo
   * @param {Number} sequence optional sequence
   * @returns {Promise<*>}
   */
  async redelegate(validatorFrom, validatorTo, amount, fee, denom = "nund", delegator = this.address, memo = "", sequence = null) {
    if (!delegator) {
      throw new Error("delegator should not be empty")
    }
    if(!crypto.checkAddress(delegator, CONFIG.BECH32_PREFIX)) {
      throw new Error("invalid delegator")
    }
    if (!validatorFrom) {
      throw new Error("validator should not be empty")
    }
    if(!crypto.checkAddress(validatorFrom, CONFIG.BECH32_VAL_PREFIX)) {
      throw new Error("invalid validatorFrom")
    }
    if (!validatorTo) {
      throw new Error("validator should not be empty")
    }
    if(!crypto.checkAddress(validatorTo, CONFIG.BECH32_VAL_PREFIX)) {
      throw new Error("invalid validatorTo")
    }
    if(amount === 0) {
      throw new Error("amount should not be zero")
    }

    checkNumber(amount, "amount")

    // generate MsgBeginRedelegate
    let msgData = {
      type: "MsgBeginRedelegate",
      delegator_address: delegator,
      validator_dst_address: validatorTo,
      validator_src_address: validatorFrom,
      amount: amount,
      denom: denom
    }

    const sendMsg = new GenMsg(msgData)

    let signedTx = null
    try {
      signedTx = await this._prepareTx(sendMsg, delegator, fee, sequence, memo)
    } catch(e) {
      throw(e)
    }

    return this._broadcastDelegate(signedTx)
  }

  /**
   *
   * @param {String} withdrawAddress
   * @param {Object} fee
   * @param {String} delegator optional delegator
   * @param {String} memo optional memo
   * @param {Number} sequence optional sequence
   * @returns {Promise<*>}
   */
  async modifyWithdrawAddress(withdrawAddress, fee, delegator = this.address, memo = "", sequence = null) {
    if (!delegator) {
      throw new Error("delegator should not be empty")
    }
    if(!crypto.checkAddress(delegator, CONFIG.BECH32_PREFIX)) {
      throw new Error("invalid delegator")
    }
    if (!withdrawAddress) {
      throw new Error("withdrawAddress should not be empty")
    }
    if(!crypto.checkAddress(withdrawAddress, CONFIG.BECH32_PREFIX)) {
      throw new Error("invalid withdrawAddress")
    }

    // generate MsgModifyWithdrawAddress
    let msgData = {
      type: "MsgModifyWithdrawAddress",
      delegator_address: delegator,
      withdraw_address: withdrawAddress
    }

    const sendMsg = new GenMsg(msgData)

    let signedTx = null
    try {
      signedTx = await this._prepareTx(sendMsg, delegator, fee, sequence, memo)
    } catch(e) {
      throw(e)
    }

    return this._broadcastDelegate(signedTx)
  }

  /**
   * Withdraw Delegator rewards
   * @param {String} validator
   * @param {Object} fee
   * @param {String} delegator optional delegator
   * @param {String} memo optional memo
   * @param {Number} sequence optional sequence
   * @returns {Promise<*>}
   */
  async withdrawDelegationReward(validator, fee, delegator = this.address, memo = "", sequence = null) {
    if (!delegator) {
      throw new Error("delegator should not be empty")
    }
    if(!crypto.checkAddress(delegator, CONFIG.BECH32_PREFIX)) {
      throw new Error("invalid delegator")
    }
    if (!validator) {
      throw new Error("validator should not be empty")
    }

    // generate MsgWithdrawDelegationReward
    let msgData = {
      type: "MsgWithdrawDelegationReward",
      delegator_address: delegator,
      validator_address: validator
    }

    const sendMsg = new GenMsg(msgData)

    let signedTx = null
    try {
      signedTx = await this._prepareTx(sendMsg, delegator, fee, sequence, memo)
    } catch(e) {
      throw(e)
    }

    return this._broadcastDelegate(signedTx)
  }

  /**
   * Prepare a raw transaction for sending to the blockchain.
   * @param msg
   * @param address
   * @param fee
   * @param sequence
   * @param memo
   * @returns {Object}
   * @private
   */
  async _prepareTx(msg, address, fee, sequence = null, memo = "") {
    if ((!this.account_number || (sequence !== 0 && !sequence)) && address) {
      try {
        const data = await this._httpClient.request("get", `${CONFIG.API_QUERY_ACCOUNT}/${address}`)
        const accData = data.result.result.account.value
        sequence = accData.sequence
        this.account_number = accData.account_number
      } catch(e) {
        throw(e)
      }
      // if user has not used `await` in its call to setPrivateKey (old API), we should wait for the promise here
    } else if (this._setPkPromise) {
      await this._setPkPromise
    }

    const options = {
      account_number: parseInt(this.account_number),
      chain_id: this.chainId,
      memo: memo,
      msg: msg,
      sequence: parseInt(sequence),
      fee: fee
    }

    const tx = new Transaction(options)
    try {
      await this._signingDelegate.call(this, tx)
    } catch(e) {
      throw(e)
    }
    return tx.genSignedTx(this._broadcastMode)
  }

  /**
   * Broadcast a transaction to the blockchain.
   * @param {signedTx} tx signed Transaction object
   * @return {Promise} resolves with response (success or fail)
   */
  async sendTransaction(signedTx) {
    return this.sendRawTransaction(signedTx)
  }

  /**
   * Broadcast a raw transaction to the blockchain.
   * @param {String} signedBz signed and serialized raw transaction
   * @return {Promise} resolves with response (success or fail)
   */
  async sendRawTransaction(signedBz) {
    const opts = {
      data: JSON.stringify(signedBz),
      headers: {
        "content-type": "text/plain",
      }
    }
    try {
      const data = this._httpClient.request("post", `${CONFIG.API_BROADCAST_TX}`, null, opts)
      return data
    } catch (err) {
      return this._stdError(err.toString())
    }
  }

  /**
   * get BEACON params
   * @returns {Promise<{result: {error: *}, status: number}|{result: *, status: *}|void>}
   */
  async getBeaconParams() {
    try {
      const data = await this._httpClient.request("get", `${CONFIG.API_QUERY_BEACON_PARAMS}`)
      return data
    } catch (err) {
      return this._stdError(err.toString())
    }
  }

  /**
   * get WRKChain params
   * @returns {Promise<{result: {error: *}, status: number}|{result: *, status: *}|void>}
   */
  async getWRKChainParams() {
    try {
      const data = await this._httpClient.request("get", `${CONFIG.API_QUERY_WRKCHAIN_PARAMS}`)
      return data
    } catch (err) {
      return this._stdError(err.toString())
    }
  }

  /**
   * get account
   * @param {String} address
   * @return {Promise} resolves with http response
   */
  async getAccount(address = this.address) {
    if (!address) {
      throw new Error("address should not be falsy")
    }
    try {
      const data = await this._httpClient.request("get", `${CONFIG.API_QUERY_ACCOUNT}/${address}`)
      return data
    } catch (err) {
      return this._stdError(err.toString())
    }
  }

  /**
   * get balances
   * @param {String} address optional address
   * @return {Promise} resolves with http response
   */
  async getBalance(address = this.address) {
    try {
      const data = await this.getAccount(address)
      return data.result.result.account.value.coins
    } catch (err) {
      return this._stdError(err.toString())
    }
  }

  /**
   * get enteprise locked FUND
   * @param {String} address optional address
   * @return {Promise} resolves with http response
   */
  async getEnterpriseLocked(address = this.address) {
    try {
      const data = await this.getAccount(address)
      if ("enterprise" in data.result.result) {
        return data.result.result.enterprise.locked
      } else {
        return this._stdError("enterprise data not found")
      }
    } catch (err) {
      return this._stdError(err.toString())
    }
  }

  /**
   * get transactions for an account
   * @param {String} address optional address
   * @param {Number} page page number, default 1
   * @param {Number} limit number of results per page, default 100, max 100
   * @return {Promise} resolves with http response
   */
  async getTransactions(address = this.address, page = 1, limit = 100) {
    if (limit > 100) limit = 100
    try {
      const data = await this._httpClient.request("get", `${CONFIG.API_QUERY_TXS}?message.sender=${address}&page=${page}&limit=${limit}`)
      return data
    } catch (err) {
      return this._stdError(err.toString())
    }
  }

  /**
   * Get transactions received by an account - specifically, FUND transfers sent to the address
   * @param {String} address optional address
   * @param {Number} page page number, default 1
   * @param {Number} limit number of results per page, default 100, max 100
   * @return {Promise} resolves with http response
   */
  async getTransactionsReceived(address = this.address, page = 1, limit = 100) {
    if (limit > 100) limit = 100
    try {
      const data = await this._httpClient.request("get", `${CONFIG.API_QUERY_TXS}?transfer.recipient=${address}&page=${page}&limit=${limit}`)
      return data
    } catch (err) {
      return this._stdError(err.toString())
    }
  }

  /**
   * Get Transactions based on arbitrary filters. Filters must be passed as an array of objects. Each
   * object must be in the format { 'key': 'the_key', 'val': 'the_val' }
   * for example:
   *
   * [
   *   {
   *     'key': 'message.sender',
   *     'val': 'und1x8pl6wzqf9atkm77ymc5vn5dnpl5xytmn200xy'
   *   },
   *   {
   *    'key': 'message.action',
   *    'val': 'register_wrkchain'
   *   },
   * ]
   *
   * will generate the query string:
   *
   * massage.sender=und1x8pl6wzqf9atkm77ymc5vn5dnpl5xytmn200xy&message.action=register_wrkchain
   *
   * @param {Array} filters - an array of filter objects
   * @param {Number} page page number, default 1
   * @param {Number} limit number of results per page, default 100, max 100
   * @returns {Promise} resolves with http response
   */
  async getFilteredTransactions(filters, page = 1, limit = 100) {
    if (limit > 100) limit = 100
    try {
      let filtersString = ""

      if(Array.isArray(filters) && filters.length > 0) {
        filters.forEach((filter) => {
          if("key" in filter && "val" in filter) {
            filtersString += "&" + filter.key + "=" + filter.val
          }
        })
      }

      if(filtersString.length === 0) {
        return this._stdError("getFilteredTransactions error: must include at least one filter passed as an array")
      }

      const data = await this._httpClient.request("get", `${CONFIG.API_QUERY_TXS}?page=${page}&limit=${limit}&${filtersString}`)
      return data
    } catch (err) {
      return this._stdError(err.toString())
    }
  }

  /**
   * get transaction
   * @param {String} hash the transaction hash
   * @return {Promise} resolves with http response
   */
  async getTx(hash) {
    try {
      const data = await this._httpClient.request("get", `${CONFIG.API_QUERY_TX}/${hash}`)
      return data
    } catch (err) {
      return this._stdError(err.toString())
    }
  }

  /**
   * get enterprise purchase orders for account
   * @param {String} address optional address
   * @param {Number} page optional page
   * @param {Number} limit optional limit
   * @returns {Promise} resolves with http response
   */
  async getEnteprisePos(address = this.address, page = 1, limit = 100) {
    if (limit > 100) limit = 100
    try {
      const data = await this._httpClient.request("get", `${CONFIG.API_QUERY_ENT_POS}?purchaser=${address}&page=${page}&limit=${limit}`)
      return data
    } catch (err) {
      return this._stdError(err.toString())
    }
  }

  /**
   * get delegations for address
   * @param {String} address optional address
   * @param {String} valAddress optional Bech32 operator address
   * @returns {Promise} resolves with http response
   */
  async getDelegations(address = this.address, valAddress = "") {
    try {
      let suffix = ""
      if(valAddress.length > 0) {
        suffix = `/${valAddress}`
      }
      const data = await this._httpClient.request("get", `${CONFIG.API_QUERY_STAKING_DELEGATORS_PREFIX}/${address}/${CONFIG.API_QUERY_STAKING_DELEGATIONS_SUFFIX}${suffix}`)
      return data
    } catch (err) {
      return this._stdError(err.toString())
    }
  }

  /**
   * get unbonding delegations for address
   * @param {String} address optional Bech32 address
   * @param {String} valAddress optional Bech32 operator address
   * @returns {Promise} resolves with http response
   */
  async getUnbondingDelegations(address = this.address, valAddress = "") {
    try {
      let suffix = ""
      if(valAddress.length > 0) {
        suffix = `/${valAddress}`
      }
      const data = await this._httpClient.request("get", `${CONFIG.API_QUERY_STAKING_DELEGATORS_PREFIX}/${address}/${CONFIG.API_QUERY_STAKING_UNBONDING_DELEGATIONS_SUFFIX}${suffix}`)
      return data
    } catch (err) {
      return this._stdError(err.toString())
    }
  }

  /**
   * get bonded validators for delegator address
   * @param {String} address optional address
   * @param {String} valAddress optional Bech32 operator address
   * @returns {Promise} resolves with http response
   */
  async getBondedValidators(address = this.address, valAddress = "") {
    try {
      let suffix = ""
      if(valAddress.length > 0) {
        suffix = `/${valAddress}`
      }
      const data = await this._httpClient.request("get", `${CONFIG.API_QUERY_STAKING_DELEGATORS_PREFIX}/${address}/${CONFIG.API_QUERY_STAKING_VALIDATORS_SUFFIX}${suffix}`)
      return data
    } catch (err) {
      return this._stdError(err.toString())
    }
  }

  /**
   * get delegator address's rewards
   * @param {String} address optional address
   * @param {String} valAddress optional Bech32 operator address
   * @returns {Promise} resolves with http response
   */
  async getDelegatorRewards(address = this.address, valAddress = "") {
    try {
      let suffix = ""
      if(valAddress.length > 0) {
        suffix = `/${valAddress}`
      }
      const data = await this._httpClient.request("get", `${CONFIG.API_QUERY_DISTRIBUTION_DELEGATORS_PREFIX}/${address}/${CONFIG.API_QUERY_DISTRIBUTION_REWARDS_SUFFIX}${suffix}`)
      return data
    } catch (err) {
      return this._stdError(err.toString())
    }
  }

  /**
   * get delegator's current withdraw address
   * @param {String} address optional address
   * @returns {Promise} resolves with http response
   */
  async getDelegatorWithdrawAddress(address = this.address) {
    try {
      const data = await this._httpClient.request("get", `${CONFIG.API_QUERY_DISTRIBUTION_DELEGATORS_PREFIX}/${address}/${CONFIG.API_QUERY_DISTRIBUTION_WITHDRAW_ADDRESS_SUFFIX}`)
      return data
    } catch (err) {
      return this._stdError(err.toString())
    }
  }

  /**
   * get a list of current validators based on filters
   * @param {String} status optional status. one of bonded, unbonded, unbonding. Default bonded
   * @param {Number} page optional page
   * @param {Number} limit optional limit
   * @param {String} valAddress optional Bech32 operator address
   * @returns {Promise} resolves with http response
   */
  async getValidators(status = "bonded", page = 1, limit = 100, valAddress = "") {
    if (limit > 100) limit = 100
    switch(status) {
      case "bonded":
      case "unbonded":
      case "unbonding":
        break
      default:
        status = "bonded"
        break
    }

    let suffix = `?status=${status}&page=${page}&limit=${limit}`
    if(valAddress.length > 0) {
      suffix = `/${valAddress}`
    }
    try {
      const data = await this._httpClient.request("get", `${CONFIG.API_QUERY_STAKING_VALIDATORS_PREFIX}${suffix}`)
      return data
    } catch (err) {
      return this._stdError(err.toString())
    }
  }

  /**
   * get a validator's bonded delegations
   * @param {String} valAddress
   * @returns {Promise} resolves with http response
   */
  async getValidatorDelegations(valAddress) {
    try {
      const data = await this._httpClient.request("get", `${CONFIG.API_QUERY_STAKING_VALIDATORS_PREFIX}/${valAddress}/${CONFIG.API_QUERY_STAKING_DELEGATIONS_SUFFIX}`)
      return data
    } catch (err) {
      return this._stdError(err.toString())
    }
  }

  /**
   * get a validator's unbonding delegations
   * @param {String} valAddress bech32 operator address
   * @returns {Promise} resolves with http response
   */
  async getValidatorUnbondingDelegations(valAddress) {
    try {
      const data = await this._httpClient.request("get", `${CONFIG.API_QUERY_STAKING_VALIDATORS_PREFIX}/${valAddress}/${CONFIG.API_QUERY_STAKING_UNBONDING_DELEGATIONS_SUFFIX}`)
      return data
    } catch (err) {
      return this._stdError(err.toString())
    }
  }

  /**
   * get redelegations, with optional filters
   * @param {String} delAddress optional delAddress Bech32 address
   * @param {String} valSrcAddress optional valSrcAddress Bech32 operator address
   * @param {String} valDestAddress optional valDestAddress Bech32 operator address
   * @returns {Promise} resolves with http response
   */
  async getRedelegations(delAddress = "", valSrcAddress = "", valDestAddress = "") {
    try {
      const data = await this._httpClient.request("get", `${CONFIG.API_QUERY_STAKING_REDELEGATIONS}?delegator=${delAddress}&validator_from=${valSrcAddress}&validator_to=${valDestAddress}`)
      return data
    } catch (err) {
      return this._stdError(err.toString())
    }
  }

  /**
   * get distribution information for a given validator's operator address
   * @param {String} valAddress bech32 operator address
   * @returns {Promise} resolves with http response
   */
  async getValidatorDistributionInfo(valAddress) {
    try {
      const data = await this._httpClient.request("get", `${CONFIG.API_QUERY_DISTRIBUTION_VALIDATORS_PREFIX}/${valAddress}`)
      return data
    } catch (err) {
      return this._stdError(err.toString())
    }
  }

  /**
   * get Fee distribution outstanding rewards of a single validator
   * @param {String} valAddress bech32 operator address
   * @returns {Promise} resolves with http response
   */
  async getValidatorDistributionOutstandingRewards(valAddress) {
    try {
      const data = await this._httpClient.request("get", `${CONFIG.API_QUERY_DISTRIBUTION_VALIDATORS_PREFIX}/${valAddress}/${CONFIG.API_QUERY_DISTRIBUTION_OUTSTANDING_REWARDS_SUFFIX}`)
      return data
    } catch (err) {
      return this._stdError(err.toString())
    }
  }

  /**
   * get Commission and self-delegation rewards of a single validator
   * @param {String} valAddress bech32 operator address
   * @returns {Promise} resolves with http response
   */
  async getValidatorDistributionRewards(valAddress) {
    try {
      const data = await this._httpClient.request("get", `${CONFIG.API_QUERY_DISTRIBUTION_VALIDATORS_PREFIX}/${valAddress}/${CONFIG.API_QUERY_DISTRIBUTION_REWARDS_SUFFIX}`)
      return data
    } catch (err) {
      return this._stdError(err.toString())
    }
  }

  /**
   * get total supply of FUND
   * @returns {Promise} resolves with http response
   */
  async getTotalSupply() {
    try {
      const data = await this._httpClient.request("get", `${CONFIG.API_QUERY_SUPPLY}`)
      return data
    } catch (err) {
      return this._stdError(err.toString())
    }
  }

  /**
   * check is given address is able to raise Enterprise purchase orders
   * @param {String} address
   * @returns {Promise} resolves with http response
   */
  async getIsAddressEntWhitelisted(address = this.address) {
    try {
      const data = await this._httpClient.request("get", `${CONFIG.API_QUERY_ENT_WHITELISTED}/${address}`)
      return data
    } catch (err) {
      return this._stdError(err.toString())
    }
  }

  /**
   * Creates a private key and returns it and its address.
   * @return {object} the private key and address in an object.
   * {
   *  address,
   *  privateKey
   * }
   */
  createAccount() {
    const privateKey = crypto.generatePrivateKey()
    return {
      privateKey,
      address: crypto.getAddressFromPrivateKey(privateKey, CONFIG.BECH32_PREFIX)
    }
  }

  /**
   * Creates an account keystore object, and returns the private key and address.
   * @param {String} password
   *  {
   *  privateKey,
   *  address,
   *  keystore
   * }
   */
  createAccountWithKeystore(password) {
    if (!password) {
      throw new Error("password should not be falsy")
    }
    const privateKey = crypto.generatePrivateKey()
    const address = crypto.getAddressFromPrivateKey(privateKey, CONFIG.BECH32_PREFIX)
    const keystore = crypto.generateKeyStore(privateKey, password)
    return {
      privateKey,
      address,
      keystore
    }
  }

  /**
   * Creates an account from mnemonic seed phrase.
   * @return {object}
   * {
   *  privateKey,
   *  address,
   *  mnemonic
   * }
   */
  createAccountWithMneomnic() {
    const mnemonic = crypto.generateMnemonic()
    const privateKey = crypto.getPrivateKeyFromMnemonic(mnemonic)
    const address = crypto.getAddressFromPrivateKey(privateKey, CONFIG.BECH32_PREFIX)
    return {
      privateKey,
      address,
      mnemonic
    }
  }

  /**
   * Recovers an account from a keystore object.
   * @param {object} keystore object.
   * @param {string} password password.
   * {
   * privateKey,
   * address
   * }
   */
  recoverAccountFromKeystore(keystore, password) {
    const privateKey = crypto.getPrivateKeyFromKeyStore(keystore, password)
    const address = crypto.getAddressFromPrivateKey(privateKey, CONFIG.BECH32_PREFIX)
    return {
      privateKey,
      address
    }
  }

  /**
   * Recovers an account from a mnemonic seed phrase.
   * @param {String} mneomnic
   * {
   * privateKey,
   * address
   * }
   */
  recoverAccountFromMnemonic(mnemonic) {
    const privateKey = crypto.getPrivateKeyFromMnemonic(mnemonic)
    const address = crypto.getAddressFromPrivateKey(privateKey, CONFIG.BECH32_PREFIX)
    return {
      privateKey,
      address
    }
  }

  /**
   * Recovers an account using private key.
   * @param {String} privateKey
   * {
   * privateKey,
   * address
   * }
   */
  recoverAccountFromPrivateKey(privateKey) {
    const address = crypto.getAddressFromPrivateKey(privateKey, CONFIG.BECH32_PREFIX)
    return {
      privateKey,
      address
    }
  }

  /**
   * Validates an address.
   * @param {String} address
   * @param {String} prefix
   * @return {Boolean}
   */
  checkAddress(address, prefix = CONFIG.BECH32_PREFIX) {
    return crypto.checkAddress(address, prefix)
  }

  /**
   * Returns the address for the current account if setPrivateKey has been called on this client.
   * @return {String}
   */
  getClientKeyAddress() {
    if (!this.privateKey) throw new Error("no private key is set on this client")
    const address = crypto.getAddressFromPrivateKey(this.privateKey, CONFIG.BECH32_PREFIX)
    this.address = address
    return address
  }

  /**
   * Retuns a standard error mimicking the object returned by _httpClient.request
   * @param {String} errMsg the message to be put in result.error
   * @param {Number} status - status code, optional. Default 400
   * @returns {{result: {error: *}, status: number}}
   * @private
   */
  _stdError(errMsg, status = 400) {
    const stdError = {
      status: status,
      result: {
        error: errMsg
      }
    }

    return stdError
  }
}