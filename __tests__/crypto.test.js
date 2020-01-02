// import * as crypto from "../src/crypto"
import { crypto } from "../src"
import * as bip39 from "bip39"

const privateKey = crypto.generatePrivateKey()
const keyStore = crypto.generateKeyStore(privateKey, "1234567")

describe("crypto", () => {

  it("generate a random address", () => {
    const privateKey = crypto.generatePrivateKey()
    const address = crypto.getAddressFromPrivateKey(privateKey)
    expect(address.length).toBe(42)
  })

  it("generate an address from privateKey", () => {
    const privateKey = "4997c324f80602979c776ea2f838435373ccb78d83b1755ae282fdfab98f8c96"
    const address = crypto.getAddressFromPrivateKey(privateKey)
    expect(address).toBe("und1n4ylq3pfzvld4a89ps8h0k7ddfxph7rc33g2dm")
  })

  it("generate an address from publicKey", () => {
    const privateKey = "4997c324f80602979c776ea2f838435373ccb78d83b1755ae282fdfab98f8c96"
    const publicKey = crypto.getPublicKeyFromPrivateKey(privateKey)
    const address = crypto.getAddressFromPublicKey(publicKey)
    expect(address).toBe("und1n4ylq3pfzvld4a89ps8h0k7ddfxph7rc33g2dm")
  })

  it("generate private key from keyStore", () => {
    const pk = crypto.getPrivateKeyFromKeyStore(keyStore, "1234567")
    expect(pk).toBe(privateKey)
  })

  it("generate private key from mnemonic", () => {
    const pk = crypto.getPrivateKeyFromMnemonic("chalk critic click web shove almost day oven awkward husband evoke switch margin judge bread notice envelope remove multiply employ december fatal wisdom rain")
    expect(pk.toString("hex")).toBe("1137295d537a80d60c99790246e59778f232c01e3e96013f587db1d360ccb377")
  })

  it("generate mnemonic", ()=>{
    const mnemonic = crypto.generateMnemonic()
    expect(bip39.validateMnemonic(mnemonic)).toBe(true)
  })

  it("decodeAddress", ()=>{
    let address = "und1x8pl6wzqf9atkm77ymc5vn5dnpl5xytmn200xy"
    const decod = crypto.decodeAddress(address)
    expect(decod.toString("hex")).toBe("31c3fd3840497abb6fde26f1464e8d987f43117b")
  })

  it("generate address from mnemonic", () => {
    const mnemonic = "chalk critic click web shove almost day oven awkward husband evoke switch margin judge bread notice envelope remove multiply employ december fatal wisdom rain"
    const pk = crypto.getPrivateKeyFromMnemonic(mnemonic)
    const address = crypto.getAddressFromPrivateKey(pk)
    expect(address).toBe("und1x8pl6wzqf9atkm77ymc5vn5dnpl5xytmn200xy")
  })

  it("generate address from mnemonic with index 1", () => {
    const mnemonic = "chalk critic click web shove almost day oven awkward husband evoke switch margin judge bread notice envelope remove multiply employ december fatal wisdom rain"
    const pk = crypto.getPrivateKeyFromMnemonic(mnemonic, true, 1)
    const address = crypto.getAddressFromPrivateKey(pk)
    expect(address).toBe("und1hlndfp4ucqre7lmpngzsypvc0uwkjnmaujpfwe")
  })

  it("generateSignature", () => {
    const privateKey = "30c5e838578a29e3e9273edddd753d6c9b38aca2446dd84bdfe2e5988b0da0a1"
    const msg = "7b226163636f756e745f6e756d626572223a2231222c22636861696e5f6964223a22626e62636861696e2d31303030222c226d656d6f223a22222c226d736773223a5b7b226964223a22423635363144434331303431333030353941374330384634384336343631304331463646393036342d3130222c226f7264657274797065223a322c227072696365223a3130303030303030302c227175616e74697479223a313230303030303030302c2273656e646572223a22626e63316b6574706d6e71736779637174786e7570723667636572707073306b6c797279687a36667a6c222c2273696465223a312c2273796d626f6c223a224254432d3543345f424e42222c2274696d65696e666f726365223a317d5d2c2273657175656e6365223a2239227d"
    const sig = crypto.generateSignature(msg, privateKey).toString("hex")
    expect(sig).toBe("9c0421217ef92d556a14e3f442b07c85f6fc706dfcd8a72d6b58f05f96e95aa226b10f7cf62ccf7c9d5d953fa2c9ae80a1eacaf0c779d0253f1a34afd17eef34")
  })

  it("verifySignature", () => {
    const publicKey = crypto.getPublicKeyFromPrivateKey(privateKey)
    const msg = "7b226163636f756e745f6e756d626572223a2231222c22636861696e5f6964223a22626e62636861696e2d31303030222c226d656d6f223a22222c226d736773223a5b7b226964223a22423635363144434331303431333030353941374330384634384336343631304331463646393036342d3130222c226f7264657274797065223a322c227072696365223a3130303030303030302c227175616e74697479223a313230303030303030302c2273656e646572223a22626e63316b6574706d6e71736779637174786e7570723667636572707073306b6c797279687a36667a6c222c2273696465223a312c2273796d626f6c223a224254432d3543345f424e42222c2274696d65696e666f726365223a317d5d2c2273657175656e6365223a2239227d"
    const sig = crypto.generateSignature(msg, privateKey).toString("hex")
    expect(crypto.verifySignature(sig, msg, publicKey)).toBeTruthy()
  })

  it("generateSignature and verifySignature - utf8 memo", () => {
    const publicKey = crypto.getPublicKeyFromPrivateKey(privateKey)
    const msg = Buffer.from("{\"account_number\":1,\"data\":\"ABCD\",\"chain_id\":\"UND-Mainchain-Devnet\",\"memo\":\"smiley!☺\",\"msgs\":[\"msg\"],\"sequence\":1,\"source\":1}").toString("hex")
    const sig = crypto.generateSignature(msg, privateKey).toString("hex")
    expect(crypto.verifySignature(sig, msg, publicKey)).toBeTruthy()
  })

})
