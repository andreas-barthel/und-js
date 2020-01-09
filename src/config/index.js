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
  API_QUERY_STAKING_VALIDATORS_PREFIX: "/staking/validators",
  API_QUERY_STAKING_REDELEGATIONS: "/staking/redelegations",
  API_QUERY_STAKING_DELEGATIONS_SUFFIX: "delegations",
  API_QUERY_STAKING_UNBONDING_DELEGATIONS_SUFFIX: "unbonding_delegations",
  API_QUERY_STAKING_VALIDATORS_SUFFIX: "validators",
  API_QUERY_DISTRIBUTION_DELEGATORS_PREFIX: "/distribution/delegators",
  API_QUERY_DISTRIBUTION_VALIDATORS_PREFIX: "/distribution/validators",
  API_QUERY_DISTRIBUTION_REWARDS_SUFFIX: "rewards",
  API_QUERY_DISTRIBUTION_WITHDRAW_ADDRESS_SUFFIX: "withdraw_address",
  API_QUERY_DISTRIBUTION_OUTSTANDING_REWARDS_SUFFIX: "outstanding_rewards",
  API_QUERY_SUPPLY: "/supply/total",
})
