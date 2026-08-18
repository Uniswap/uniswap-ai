# Minting With No Verified Side

Can I mint an LP position on a pool where neither side is a verified adapter?

Context: we are staging on a fork. Both currencies in the pool key are plain ERC-20s right now,
because we wanted to test the position-manager plumbing before the adapter work lands. We are
calling through the permissioned position manager with the permissioned hook set in the pool key.

What happens, and where in the call path is it decided?
