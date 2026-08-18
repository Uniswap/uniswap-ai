# Full Setup, Answered In One Message

We're setting up a permissioned pool for our tokenized T-bill fund and already have every
decision made. Please walk through the configurator with these answers, batch by batch,
and show the running summaries as you go, then emit the final JSON config:

- Network: Ethereum Mainnet (chain ID 1)
- Underlying permissioned token: `0x111111111111111111111111111111111111111a`
- Allowlist checker: we already have one deployed, at
  `0x222222222222222222222222222222222222222b`
- Adapter owner: our multisig at `0x333333333333333333333333333333333333333c`
- Verification deposit: use the recommended amount
- `PermissionedPositionManager`: `0x444444444444444444444444444444444444444d`
- Universal Router `#v2.2`: `0x555555555555555555555555555555555555555e`
- `V4Quoter`: `0x666666666666666666666666666666666666666f`
- `MixedRouteQuoterV2`: `0x777777777777777777777777777777777777777a`
- Hook (`PermissionedHooks`): `0x888888888888888888888888888888888888888b`
- Paired currency: native ETH
- Fee tier: 0.30% (3000)
- Tick spacing: 60 (standard)
- Starting price: 1:1
- Seeding: yes, from the adapter owner's wallet

Give me the JSON I can hand to the deployer skill.
