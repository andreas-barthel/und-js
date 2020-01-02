import * as encoder from "../src/encoder"
import { UVarInt } from "../src/encoder/varint"

describe("encoder", () => {
  it("encode time", () => {
    let encodedTime = encoder.encodeTime("1973-11-29T21:33:09.123456789Z")
    encodedTime = encodedTime.toString("hex")
    expect(encodedTime).toBe("0915cd5b07000000001515cd5b07")
  })

  it("encode number", () => {
    let encodedNumber = encoder.encodeNumber(100000)
    encodedNumber = encodedNumber.toString("hex")
    expect(encodedNumber).toBe("a08d06")
  })

  it("encode negtive number", () => {
    expect(() => {
      encoder.encodeNumber(-100000)
    }).toThrow()
  })

  it("encode big number", () => {
    let encodedNumber = encoder.encodeNumber(Math.pow(10, 18))
    encodedNumber = encodedNumber.toString("hex")
    expect(encodedNumber).toBe("808090bbbad6adf00d")
  })

  it("UVarInt", () => {
    let encodedNumber = UVarInt.encode(17)
    encodedNumber = encodedNumber.toString("hex")
    expect(encodedNumber).toBe("11")
  })

  it("encode bool", () => {
    let encodedTrue = encoder.encodeBool(true)
    encodedTrue = encodedTrue.toString("hex")
    expect(encodedTrue).toBe("01")

    let encodedFalse = encoder.encodeBool(false)
    encodedFalse = encodedFalse.toString("hex")
    expect(encodedFalse).toBe("00")
  })

  it("encode string", () => {
    const str = "You are beautiful"
    let encodedString = encoder.encodeString(str)
    encodedString = encodedString.toString("hex")
    expect(encodedString).toBe("11596f75206172652062656175746966756c")
  })

  it("convertObjectToSignBytes", () => {
    // unsorted, expect convertObjectToSignBytes to sort it
    const jsonObj = {
      sender: 2,
      symbol: 3,
      zlast: [{z: "z", a: "z"}, {z: "a", a: "z"}],
      address: 1
    }
    const str = encoder.convertObjectToSignBytes(jsonObj)
    expect(str.toString()).toBe("{\"address\":1,\"sender\":2,\"symbol\":3,\"zlast\":[{\"a\":\"z\",\"z\":\"z\"},{\"a\":\"z\",\"z\":\"a\"}]}")
  })
})
