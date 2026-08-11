# Allowlist Checker Skeleton

We are an issuer bringing a transfer-restricted ERC-20 into a Uniswap v4 permissioned pool. Our
compliance system already exposes an on-chain registry of approved wallets, so the checker itself
should be thin.

Write me the skeleton of an allowlist checker for our token, extending the base checker from
v4-periphery.

Also answer these, because our build broke twice already:

1. What visibility does `checkAllowlist` need, and why is that the answer?
2. Does the adapter require anything of the checker contract itself, beyond that one function?
3. Which import path and which file name do we use — our `forge inspect` invocation kept failing
   with a "contract not found" style error.

Keep the Solidity minimal, but get every identifier exactly right.
