# setAllowedHook Reverts For The Adapter Owner

I own the adapter but haven't verified it yet. `setAllowedHook` reverts — why?

Details:

- The adapter was created with our treasury multisig as `initialOwner`, and `owner()` on the adapter
  returns that multisig.
- The multisig is the sender of the `setAllowedHook` call.
- We are passing the adapter currency and the permissioned hook address, with `allowed` set to true.

The revert is `NotPermissionsAdapterAdmin`, which reads like the contract does not think we are the
admin. We are. What is actually being checked, and what do we have to do first?
