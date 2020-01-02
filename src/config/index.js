// Configuration values

module.exports = Object.freeze({
  // HD Path, prefixes, coin
  HD_PATH: "44'/5555'/0'/0/",
  BECH32_PREFIX: "und",
  BASENUMBER: Math.pow(10, 9),

  // RPC API Endpoints
  API_QUERY_TX: "/txs",
  API_QUERY_TXS: "/txs",
  API_BROADCAST_TX: "/txs",
  API_NODE_INFO: "/node_info",
  API_QUERY_ACCOUNT: "/auth/accounts"

})
