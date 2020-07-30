import * as crypto from "../crypto/"
import * as encoder from "../encoder/"
import { getUsbTransport, reParseLedgerError } from "../utils"
import CosmosApp from "ledger-cosmos-js"
import Secp256k1 from "secp256k1";

const CONFIG = require("../config")
const {JSONsort} = require("../utils")

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

  async signLedger(path, ts = "WebUSB") {
    let transport = null;
    try {
      transport = await getUsbTransport(ts)
    } catch (e) {
      throw(e)
    }

    if(!transport) {
      throw new Error("no transport method set")
    }

    const app = new CosmosApp(transport);

    // Ledger app expects sorted msg data
    let sorted = JSONsort(this.stdMsg)

    let pubKeyResponse = await app.getAddressAndPubKey(path, CONFIG.BECH32_PREFIX)

    if (pubKeyResponse.return_code !== 0x9000) {
      pubKeyResponse = reParseLedgerError(pubKeyResponse)
      throw new Error(`Ledger app Error [${pubKeyResponse.return_code}] ${pubKeyResponse.error_message}`)
    }
    const pubKeyBase64 = Buffer.from(pubKeyResponse.compressed_pk).toString("base64")

    let response = await app.sign(path, JSON.stringify(sorted));

    if (response.return_code !== 0x9000) {
      response = reParseLedgerError(response)
      throw new Error(`Ledger app Error [${response.return_code}] ${response.error_message}`);
    }
    const signatureBase64 = Buffer.from(Secp256k1.signatureImport(response.signature)).toString("base64")

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