// Configuration values

module.exports = Object.freeze({
  // HD Path, prefixes, coin
  HD_PATH: "44'/5555'/0'/0/",
  BECH32_PREFIX: "und",
  BECH32_VAL_PREFIX: "undvaloper",
  BASENUMBER: Math.pow(10, 9),

  // RPC API Endpoints
  API_QUERY_TX: "/txs",
  API_QUERY_TXS: "/txs",
  API_BROADCAST_TX: "/txs",
  API_NODE_INFO: "/node_info",
  API_QUERY_ACCOUNT: "/auth/accounts",
  API_QUERY_ENT_POS: "/enterprise/pos",
  API_QUERY_STAKING_DELEGATORS_PREFIX: "/staking/delegators",
  API_QUERY_STAKING_DELEGATIONS: "delegations",
  API_QUERY_STAKING_UNBONDING_DELEGATIONS: "unbonding_delegations",
  API_QUERY_STAKING_VALIDATORS: "validators",

})
