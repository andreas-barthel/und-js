import Big from "big.js"

const CONFIG = require("../config")

const SupportedMsgs = {
  MsgSend: "cosmos-sdk/MsgSend",
  PurchaseUnd: "enterprise/PurchaseUnd",
  MsgDelegate: "cosmos-sdk/MsgDelegate",
  MsgUndelegate: "cosmos-sdk/MsgUndelegate",
  MsgWithdrawDelegationReward: "cosmos-sdk/MsgWithdrawDelegationReward",
  MsgBeginRedelegate: "cosmos-sdk/MsgBeginRedelegate",
  MsgModifyWithdrawAddress: "cosmos-sdk/MsgModifyWithdrawAddress",
  RegisterBeacon: "beacon/RegisterBeacon",
  RecordBeaconTimestamp: "beacon/RecordBeaconTimestamp",
  RegisterWrkChain: "wrkchain/RegisterWrkChain",
  RecordWrkChainBlock: "wrkchain/RecordWrkChainBlock"
}

class GenMsg {
  constructor(data) {
    if(!SupportedMsgs[data.type]) {
      throw new TypeError(`does not support transaction type: ${data.type}`)
    }

    let msg = {
      type: SupportedMsgs[data.type],
      value: null
    }

    switch(data.type) {
      case "MsgSend":
        msg.value = this._generateSendMsg(data)
        return msg
      case "PurchaseUnd":
        msg.value = this._generateRaiseEnterprisePurchaseOrder(data)
        return msg
      case "MsgDelegate":
      case "MsgUndelegate":
        msg.value = this._generateMsgDelegate(data)
        return msg
      case "MsgWithdrawDelegationReward":
        msg.value = this._generateMsgWithdrawDelegationReward(data)
        return msg
      case "MsgBeginRedelegate":
        msg.value = this._generateMsgBeginRedelegate(data)
        return msg
      case "MsgModifyWithdrawAddress":
        msg.value = this._generateMsgModifyWithdrawAddress(data)
        return msg
      case "RegisterBeacon":
        msg.value = this._generateRegisterBeacon(data)
        return msg
      case "RecordBeaconTimestamp":
        msg.value = this._generateRecordBeaconTimestamp(data)
        return msg
      case "RegisterWrkChain":
        msg.value = this._generateRegisterWrkChain(data)
        return msg
      case "RecordWrkChainBlock":
        msg.value = this._generateRecordWrkChainBlock(data)
        return msg
    }
  }

  _generateCoinobj(amount, denom) {
    amount = new Big(amount)

    if(denom === "und" || denom === "fund") {
      amount = Number(amount.mul(CONFIG.BASENUMBER))
      denom = "nund"
    }

    const coin = {
      denom: denom,
      amount: amount.toString(),
    }

    return coin
  }

  _generateSendMsg(data) {
    const coin = this._generateCoinobj(data.amount, data.denom)

    const value = {
      from_address: data.from,
      to_address: data.to,
      amount: [coin]
    }
    return value
  }

  _generateRaiseEnterprisePurchaseOrder(data) {
    const coin = this._generateCoinobj(data.amount, data.denom)

    const value = {
      purchaser: data.from,
      amount: coin
    }

    return value
  }

  _generateMsgDelegate(data) {
    const coin = this._generateCoinobj(data.amount, data.denom)

    const value = {
      amount: coin,
      delegator_address: data.delegator_address,
      validator_address: data.validator_address
    }

    return value
  }

  _generateMsgWithdrawDelegationReward(data) {
    const value = {
      delegator_address: data.delegator_address,
      validator_address: data.validator_address
    }

    return value
  }

  _generateMsgBeginRedelegate(data) {
    const coin = this._generateCoinobj(data.amount, data.denom)
    const value = {
      amount: coin,
      delegator_address: data.delegator_address,
      validator_dst_address: data.validator_dst_address,
      validator_src_address: data.validator_src_address
    }

    return value
  }

  _generateMsgModifyWithdrawAddress(data) {
    const value = {
      delegator_address: data.delegator_address,
      withdraw_address: data.withdraw_address
    }

    return value
  }

  _generateRegisterBeacon(data) {
    const value = {
      moniker: data.moniker,
      name: data.name,
      owner: data.owner
    }
    return value
  }

  _generateRecordBeaconTimestamp(data) {
    const value = {
      beacon_id: data.beacon_id,
      hash: data.hash,
      submit_time: data.submit_time,
      owner: data.owner
    }
    return value
  }

  _generateRegisterWrkChain(data) {
    const value = {
      moniker: data.moniker,
      name: data.name,
      genesis: data.genesis,
      type: data.base_type,
      owner: data.owner
    }
    return value
  }

  _generateRecordWrkChainBlock(data) {
    const value = {
      wrkchain_id: data.wrkchain_id,
      height: data.height,
      blockhash: data.blockhash,
      parenthash: data.parenthash,
      hash1: data.hash1,
      hash2: data.hash2,
      hash3: data.hash3,
      owner: data.owner
    }
    return value
  }
}

export default GenMsg
