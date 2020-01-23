/**
 * @module client
 */
import * as crypto from "../crypto"
import HttpRequest from "../utils/request"
import GenMsg from "../msg"
import Transaction from "../tx"
import { checkNumber } from "../utils/validateHelper"

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
 * The default broadcast delegate which immediately broadcasts a transaction.
 * @param {Transaction} signedTx the signed transaction
 */
export const DefaultBroadcastDelegate = async function (signedTx) {
  return this.sendTransaction(signedTx)
}

/**
 * The UND Mainchain client.
 */
export class UndClient {
  /**
   * @param {String} server UND Mainchain public url
   * @param {Boolean} useAsyncBroadcast use async broadcast mode, faster but less guarantees (default off)
   * @param {Number} source where does this transaction come from (default 0)
   */
  constructor(server) {
    if (!server) {
      throw new Error("UND Mainchain server should not be null")
    }
    this._httpClient = new HttpRequest(server)
    this._signingDelegate = DefaultSigningDelegate
    this._broadcastDelegate = DefaultBroadcastDelegate
  }

  /**
   * Initialize the client with the chain's ID. Asynchronous.
   * @return {Promise}
   */
  async initChain() {
    if (!this.chainId) {
      const data = await this._httpClient.request("get", CONFIG.API_NODE_INFO)
      this.chainId = data.result.node_info && data.result.node_info.network
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
      if (!address) throw new Error("address is falsy: ${address}. invalid private key?")
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
   * Sets the client's account number.
   * @param {boolean} accountNumber
   */
  setAccountNumber(accountNumber) {
    this.account_number = accountNumber
  }

  /**
   * Sets the signing delegate (for wallet integrations).
   * @param {function} delegate
   * @return {UndClient} this instance (for chaining)
   */
  setSigningDelegate(delegate) {
    if (typeof delegate !== "function") throw new Error("signing delegate must be a function")
    this._signingDelegate = delegate
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
    return this
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
   * Transfer UND to an address
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

    const signedTx = await this._prepareTx(sendMsg, fromAddress, fee, sequence, memo)

    return this._broadcastDelegate(signedTx)
  }

  /**
   * Raise an Enterprise UND Purchase Order
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

    const signedTx = await this._prepareTx(sendMsg, fromAddress, fee, sequence, memo)

    return this._broadcastDelegate(signedTx)
  }

  /**
   * Delegate UND to a validator
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

    const signedTx = await this._prepareTx(sendMsg, delegator, fee, sequence, memo)

    return this._broadcastDelegate(signedTx)
  }

  /**
   * Undelegate UND from a validator
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

    const signedTx = await this._prepareTx(sendMsg, delegator, fee, sequence, memo)

    return this._broadcastDelegate(signedTx)
  }

  /**
   * Redelegate UND from one validator to another
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

    const signedTx = await this._prepareTx(sendMsg, delegator, fee, sequence, memo)

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

    const signedTx = await this._prepareTx(sendMsg, delegator, fee, sequence, memo)

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

    const signedTx = await this._prepareTx(sendMsg, delegator, fee, sequence, memo)

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
      const data = await this._httpClient.request("get", `${CONFIG.API_QUERY_ACCOUNT}/${address}`)
      const accData = data.result.result.account.value
      sequence = accData.sequence
      this.account_number = accData.account_number
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
    this._signingDelegate.call(this, tx)
    return tx.genSignedTx()
  }

  /**
   * Broadcast a transaction to the blockchain.
   * @param {signedTx} tx signed Transaction object
   * @param {Boolean} sync use synchronous mode, optional
   * @return {Promise} resolves with response (success or fail)
   */
  async sendTransaction(signedTx) {
    return this.sendRawTransaction(signedTx)
  }

  /**
   * Broadcast a raw transaction to the blockchain.
   * @param {String} signedBz signed and serialized raw transaction
   * @param {Boolean} sync use synchronous mode, optional
   * @return {Promise} resolves with response (success or fail)
   */
  async sendRawTransaction(signedBz) {
    const opts = {
      data: JSON.stringify(signedBz),
      headers: {
        "content-type": "text/plain",
      }
    }
    return this._httpClient.request("post", `${CONFIG.API_BROADCAST_TX}`, null, opts)
  }

  /**
   * Broadcast a raw transaction to the blockchain.
   * @param {Object} msg the msg object
   * @param {Object} stdSignMsg the sign doc object used to generate a signature
   * @param {String} address
   * @param {Number} sequence optional sequence
   * @param {String} memo optional memo
   * @param {Boolean} sync use synchronous mode, optional
   * @return {Promise} resolves with response (success or fail)
   */
  async _sendTransaction(msg, stdSignMsg, address, sequence = null, memo = "", sync = !this._useAsyncBroadcast) {
    const signedTx = await this._prepareTransaction(msg, stdSignMsg, address, sequence, memo)
    return this.sendTransaction(signedTx, sync)
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
      return null
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
      return []
    }
  }

  /**
   * get enteprise locked UND
   * @param {String} address optional address
   * @return {Promise} resolves with http response
   */
  async getEnterpriseLocked(address = this.address) {
    try {
      const data = await this.getAccount(address)
      if ("enterprise" in data.result.result) {
        return data.result.result.enterprise.locked
      } else {
        return []
      }
    } catch (err) {
      console.warn("getEnterpriseLocked error", err)
      return []
    }
  }

  /**
   * get transactions for an account
   * @param {String} address optional address
   * @param {Number} page page number, default 1
   * @param {Number} limit number of results per page, default 100
   * @return {Promise} resolves with http response
   */
  async getTransactions(address = this.address, page = 1, limit = 100) {
    try {
      const data = await this._httpClient.request("get", `${CONFIG.API_QUERY_TXS}?message.sender=${address}&page=${page}&limit=${limit}`)
      return data
    } catch (err) {
      console.warn("getTransactions error", err)
      return []
    }
  }

  /**
   * Get transactions received by an account - specifically, UND transfers sent to the address
   * @param {String} address optional address
   * @param {Number} page page number, default 1
   * @param {Number} limit number of results per page, default 100
   * @return {Promise} resolves with http response
   */
  async getTransactionsReceived(address = this.address, page = 1, limit = 100) {
    try {
      const data = await this._httpClient.request("get", `${CONFIG.API_QUERY_TXS}?transfer.recipient=${address}&page=${page}&limit=${limit}`)
      return data
    } catch (err) {
      console.warn("getTransactions error", err)
      return []
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
      console.warn("getTx error", err)
      return []
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
    try {
      const data = await this._httpClient.request("get", `${CONFIG.API_QUERY_ENT_POS}?purchaser=${address}&page=${page}&limit=${limit}`)
      return data
    } catch (err) {
      console.warn("getEnteprisePos error", err)
      return []
    }
  }

  /**
   * get delegations for address
   * @param {String} address optional address
   * @param {String} valAddress optional Bech32 operator address
   * @returns {Promise} resolves with http response
   */
  async getDelegations(address = this.address, valAddress = '') {
    try {
      let suffix = ''
      if(valAddress.length > 0) {
        suffix = `/${valAddress}`
      }
      const data = await this._httpClient.request("get", `${CONFIG.API_QUERY_STAKING_DELEGATORS_PREFIX}/${address}/${CONFIG.API_QUERY_STAKING_DELEGATIONS_SUFFIX}${suffix}`)
      return data
    } catch (err) {
      console.warn("getDelegations error", err)
      return []
    }
  }

  /**
   * get unbonding delegations for address
   * @param {String} address optional Bech32 address
   * @param {String} valAddress optional Bech32 operator address
   * @returns {Promise} resolves with http response
   */
  async getUnbondingDelegations(address = this.address, valAddress = '') {
    try {
      let suffix = ''
      if(valAddress.length > 0) {
        suffix = `/${valAddress}`
      }
      const data = await this._httpClient.request("get", `${CONFIG.API_QUERY_STAKING_DELEGATORS_PREFIX}/${address}/${CONFIG.API_QUERY_STAKING_UNBONDING_DELEGATIONS_SUFFIX}${suffix}`)
      return data
    } catch (err) {
      console.warn("getUnbondingDelegations error", err)
      return []
    }
  }

  /**
   * get bonded validators for delegator address
   * @param {String} address optional address
   * @param {String} valAddress optional Bech32 operator address
   * @returns {Promise} resolves with http response
   */
  async getBondedValidators(address = this.address, valAddress = '') {
    try {
      let suffix = ''
      if(valAddress.length > 0) {
        suffix = `/${valAddress}`
      }
      const data = await this._httpClient.request("get", `${CONFIG.API_QUERY_STAKING_DELEGATORS_PREFIX}/${address}/${CONFIG.API_QUERY_STAKING_VALIDATORS_SUFFIX}${suffix}`)
      return data
    } catch (err) {
      console.warn("getBondedValidators error", err)
      return []
    }
  }

  /**
   * get delegator address's rewards
   * @param {String} address optional address
   * @param {String} valAddress optional Bech32 operator address
   * @returns {Promise} resolves with http response
   */
  async getDelegatorRewards(address = this.address, valAddress = '') {
    try {
      let suffix = ''
      if(valAddress.length > 0) {
        suffix = `/${valAddress}`
      }
      const data = await this._httpClient.request("get", `${CONFIG.API_QUERY_DISTRIBUTION_DELEGATORS_PREFIX}/${address}/${CONFIG.API_QUERY_DISTRIBUTION_REWARDS_SUFFIX}${suffix}`)
      return data
    } catch (err) {
      console.warn("getDelegatorRewards error", err)
      return []
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
      console.warn("getDelegatorRewards error", err)
      return []
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
  async getValidators(status = 'bonded', page = 1, limit = 100, valAddress = '') {
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
      console.warn("getValidators error", err)
      return []
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
      console.warn("getValidatorDelegations error", err)
      return []
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
      console.warn("getValidatorUnbondingDelegations error", err)
      return []
    }
  }

  /**
   * get redelegations, with optional filters
   * @param {String} delAddress optional delAddress Bech32 address
   * @param {String} valSrcAddress optional valSrcAddress Bech32 operator address
   * @param {String} valDestAddress optional valDestAddress Bech32 operator address
   * @returns {Promise} resolves with http response
   */
  async getRedelegations(delAddress = '', valSrcAddress = '', valDestAddress = '') {
    try {
      const data = await this._httpClient.request("get", `${CONFIG.API_QUERY_STAKING_REDELEGATIONS}?delegator=${delAddress}&validator_from=${valSrcAddress}&validator_to=${valDestAddress}`)
      return data
    } catch (err) {
      console.warn("getRedelegations error", err)
      return []
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
      console.warn("getValidatorDistributionInfo error", err)
      return []
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
      console.warn("getValidatorDistributionOutstandingRewards error", err)
      return []
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
      console.warn("getValidatorDistributionRewards error", err)
      return []
    }
  }

  /**
   * get total supply of UND
   * @returns {Promise} resolves with http response
   */
  async getTotalSupply() {
    try {
      const data = await this._httpClient.request("get", `${CONFIG.API_QUERY_SUPPLY}`)
      return data
    } catch (err) {
      console.warn("getTotalSupply error", err)
      return []
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
   * @param {string} mneomnic
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
}