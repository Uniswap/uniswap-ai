# First Seeding Mint Reverts With A Bare Unauthorized

Adapter created and verified, hook approved, pool initialized. Everything up to this point went
through with no reverts.

Our treasury multisig — which is the adapter owner — tries the first mint and gets a bare
`Unauthorized()`. No arguments, no other information.

What's wrong?

For context, that same multisig is on our allowlist and can swap on the pool without any problem,
so the wallet is definitely known to our checker.
