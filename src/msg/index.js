import Big from "big.js"

const CONFIG = require("../config")

const SupportedMsgs = {
  MsgSend: "cosmos-sdk/MsgSend",
  PurchaseUnd: "enterprise/PurchaseUnd",
  MsgDelegate: "cosmos-sdk/MsgDelegate",
  MsgUndelegate: "cosmos-sdk/MsgUndelegate",
  MsgWithdrawDelegationReward: "cosmos-sdk/MsgWithdrawDelegationReward",
  MsgBeginRedelegate: "cosmos-sdk/MsgBeginRedelegate",
  MsgModifyWithdrawAddress: "cosmos-sdk/MsgModifyWithdrawAddress"
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
    }
  }

  _generateCoinobj(amount, denom) {
    amount = new Big(amount)

    if(denom === "und") {
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
}

export default GenMsg
