# Allowlisting An In-House Batch Helper

Our ops team wrote a `BatchLPHelper` that forwards `modifyLiquidity` calls for our desk. It takes a
list of positions and loops, so our operators submit one transaction instead of nine.

Should I add it to `allowedWrappers`? It's fine, we wrote it.

A bit more detail, since I assume you'll ask:

- It is a plain contract, not upgradeable today, though we do have an owner-settable configuration
  address on it.
- It calls the pool manager itself. Each call is on behalf of whichever desk wallet triggered the
  batch.
- It does not implement any interface from the permissioned-pools contracts — we just wrote the
  functions we needed.

I would like a yes or no plus whatever we need to change if it's a no.
