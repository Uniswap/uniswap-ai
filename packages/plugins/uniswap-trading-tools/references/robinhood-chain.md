# Robinhood Chain template

Bundled target-chain template for Robinhood Chain (chainId `4663`). Skills read the selected target-chain template for chain-specific values; this file is the selected template when the target is Robinhood Chain, and it doubles as the pattern for adding other templates.

## Template contract

This template provides the chain id, chain name, RPC / read path, deployed Uniswap contracts, tradable token source, funding constraints, market-data availability, and transfer-restriction caveats.

## Template-specific notes

- **Trading API supports chainId 4663.** Confirmed in production: data-api chain support, UniRoute v2/v3/v4 routing, DutchV3 RFQ, and UniswapX RFQ are live on 4663. No preview build or chain-id flip is needed; skills execute through the standard Trading API path.
- **Fund wallets manually.** There is no auto-funding and no working bridge to chain 4663. Skills skip and report on insufficient token balance or gas; they never top up or move funds onto the chain. This applies to agent wallets, index-bot funding wallets, and copy-trade follower wallets.
- **Tradable set is ETH, USDG, and WETH.** RWAs are not listed yet, so RWA-denominated strategies cannot resolve until the issuer token list ships.
- **Equity market hours may impact liquidity.** RWAs may be available on this chain. If so, their liquidity and availability may be subject to regular exchange trading hours. Trading low-liquidity tokens may result in higher slippage and worse prices. For this chain, default to US regular trading hours: 09:30 to 16:00 ET, Monday to Friday, excluding US market holidays. Treat off-hours as low-liquidity rather than closed.
- **Copy-trade reads via RPC.** The operator supplies an RPC endpoint for this chain; copy-trade polls it and scans logs directly to read leader activity (for example via `getLogs`).

## Network

| Field                        | Value                                                      |
| ---------------------------- | ---------------------------------------------------------- |
| Chain name (interface param) | `robinhood`                                                |
| chainId                      | `4663`                                                     |
| Architecture                 | Arbitrum Orbit L2, ArbOS 51, parent chain Ethereum mainnet |
| Gas token                    | ETH                                                        |
| Block explorer               | <https://robinhoodchain.blockscout.com/>                   |
| Token list                   | <https://robinhoodchain.blockscout.com/tokens>             |
| RPC                          | <https://rpc.mainnet.chain.robinhood.com/>                 |
| Indexer                      | `Operator-provided`                                        |

## Uniswap contracts (chainId 4663)

Source: `Uniswap/contracts` `deployments/4663.md` (canonical summary; full record in `deployments/json/4663.json`). Verbatim from the deployment summary:

| Contract                                | Address                                      |
| --------------------------------------- | -------------------------------------------- |
| UniversalRouter                         | `0x8876789976decbfcbbbe364623c63652db8c0904` |
| Permit2                                 | `0x000000000022d473030f116ddee9f6b43ac78ba3` |
| PoolManager (v4)                        | `0x8366a39cc670b4001a1121b8f6a443a643e40951` |
| PositionManager (v4)                    | `0x58daec3116aae6d93017baaea7749052e8a04fa7` |
| V4Quoter                                | `0x8dc178efb8111bb0973dd9d722ebeff267c98f94` |
| StateView (v4)                          | `0xf3334192d15450cdd385c8b70e03f9a6bd9e673b` |
| PositionDescriptor (v4)                 | `0x9639443158e8c5efa35bd45287bf2effd3d8dc06` |
| SwapRouter02 (v2/v3)                    | `0xcaf681a66d020601342297493863e78c959e5cb2` |
| UniswapV3Factory                        | `0x1f7d7550b1b028f7571e69a784071f0205fd2efa` |
| QuoterV2 (v3)                           | `0x33e885ed0ec9bf04ecfb19341582aadcb4c8a9e7` |
| TickLens (v3)                           | `0x7dfd4f31be6814d2906bde155c3e1b146eac1468` |
| NonfungiblePositionManager (v3)         | `0x73991a25c818bf1f1128deaab1492d45638de0d3` |
| NonfungibleTokenPositionDescriptor (v3) | `0x6f84dae9c064ff453e5c8af51efb819f8f610225` |
| NFTDescriptor (v3 lib)                  | `0x2e9d45bb7b30549f5216813ada9a6b7982c5b3ed` |
| UniswapV2Factory                        | `0x8bceaa40b9acdfaedf85adf4ff01f5ad6517937f` |
| UniswapV2Router02                       | `0x89e5db8b5aa49aa85ac63f691524311aeb649eba` |
| UniswapInterfaceMulticall               | `0x282a3c4d320cc7f0d5eaf56b8029e4b88338f0a3` |
| CaliburEntry                            | `0x000000009b1d0af20d8c6d0a44e162d11f9b8f00` |
| ERC7914Detector                         | `0xc470458fc6a7e43471b31e6a2eb2612215a7102e` |
| UnsupportedProtocol                     | `0x7332D11BD10d18A04B119Cd4671a96f3148002c4` |

For swaps and LP the relevant contracts are UniversalRouter, Permit2, the v4 PoolManager / PositionManager / V4Quoter / StateView, and the v2/v3 routers and factories. The UniversalRouter `spokePool` points at UnsupportedProtocol, so bridge / cross-chain commands via the router will revert. Skill constraint: there is no bridge or cross-chain path via the router; skills use swap and LP commands only and never emit a router bridge / cross-chain command. (This is separate from wallet funding, which has no auto-fund path either; see the template-specific notes above.)

## Tradable tokens (current)

The Uniswap interface for `?chain=robinhood` currently lists three tokens. Token addresses are not part of the `4663.md` contract summary.

| Symbol | Address                                      | Notes                                         |
| ------ | -------------------------------------------- | --------------------------------------------- |
| ETH    | native                                       | gas token                                     |
| WETH   | `0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73` | Wrapped ETH                                   |
| USDG   | `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168` | Global Dollar (Paxos) stablecoin; 6 decimals. |

Deployed tokens on this chain are listed on the explorer at <https://robinhoodchain.blockscout.com/tokens>. Resolve symbols to addresses from that token list (or the Uniswap app token list), and verify a Uniswap pool exists before trading. Do not maintain a local registry or invent addresses. The USD stablecoin on this chain is USDG (Global Dollar), Robinhood Chain's native stablecoin. For a bare "top N" request there is no automatic ranking source, so ask the operator for an explicit asset list.
