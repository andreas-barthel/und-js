import Big from "big.js"

const CONFIG = require("../config")

class GenMsg {
  constructor() {
  }

  generateSendMsg(fromAddress, toAddress, amount, denom) {
    amount = new Big(amount)

    if(denom === "und") {
      amount = Number(amount.mul(CONFIG.BASENUMBER))
      denom = "nund"
    }

    const coin = {
      denom: denom,
      amount: amount.toString(),
    }

    const msg = {
      type: "cosmos-sdk/MsgSend",
      value: {
        from_address: fromAddress,
        to_address: toAddress,
        amount: [coin]
      }
    }

    return msg
  }
}

export default GenMsg
