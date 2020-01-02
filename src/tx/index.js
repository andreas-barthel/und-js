import * as crypto from "../crypto/"
import * as encoder from "../encoder/"

class Transaction {
  constructor(data) {

    if (!data.chain_id) {
      throw new Error("chain id should not be null")
    }

    data = data || {}

    this.sequence = data.sequence || 0
    this.account_number = data.account_number || 0
    this.chain_id = data.chain_id
    this.msgs = data.msg ? [data.msg] : []
    this.memo = data.memo
    this.fee = data.fee

    this._newStdMsg()
  }

  sign(privateKey) {
    if(!privateKey){
      throw new Error("private key should not be null")
    }

    const signBytes = encoder.convertObjectToSignBytes(this.stdMsg)
    const privKeyBuf = Buffer.from(privateKey, "hex")
    const signature = crypto.generateSignature(signBytes.toString("hex"), privKeyBuf)

    const signatureBase64 = Buffer.from(signature, "binary").toString("base64")
    const pubKeyBase64 =  Buffer.from(crypto.generatePubKeyCompressed(privateKey), "binary").toString("base64")

    this.signature = {
      "signature": signatureBase64,
      "pub_key": {
        "type": "tendermint/PubKeySecp256k1",
        "value": pubKeyBase64
      }
    }
  }

  genSignedTx(modeType = "sync") {
    let signedTx = {
      "tx": {
        "msg": this.msgs,
        "fee": this.fee,
        "signatures": [this.signature],
        "memo": this.memo
      },
      "mode": modeType
    }
    return signedTx
  }

  _newStdMsg() {
    this.stdMsg = {
      account_number: String(this.account_number),
      chain_id: this.chain_id,
      fee: this.fee,
      memo: this.memo,
      msgs: this.msgs,
      sequence: String(this.sequence)
    }

  }
}

export default Transaction