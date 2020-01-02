import GenMsg from "../src/msg"

const toAddress = "und150xrwj6ca9kyzz20e4x0qj6zm0206jhe4tk7nf"
const fromAddress = "und1x8pl6wzqf9atkm77ymc5vn5dnpl5xytmn200xy"

it("test unsupported message type", () => {
  const msgData = {
    type: "Unsupported"
  }
  let sendMsg = null
  expect(() => {
    sendMsg = new GenMsg(msgData)
  }).toThrow()
})

it("msgsend message type", () => {
  let msgData = {
    type: "MsgSend",
    from: fromAddress,
    to: toAddress,
    amount: 2.123,
    denom: "und"
  }
  let sendMsg = new GenMsg(msgData)

  expect(sendMsg.type).toBe("cosmos-sdk/MsgSend")
})
