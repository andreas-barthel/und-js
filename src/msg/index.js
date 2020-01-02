import Big from "big.js"

const CONFIG = require("../config")

const SupportedMsgs = {
  MsgSend: "cosmos-sdk/MsgSend",
  PurchaseUnd: "enterprise/PurchaseUnd"
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
}

export default GenMsg
