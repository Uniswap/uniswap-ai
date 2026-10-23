# Security Sign-Off Before We Approve The Listing

Our security team will not approve using these contracts until they have a published review to
read. One of them checked the `v4-hooks-public` repository yesterday, found an audits table listing
WETHHook, WstETHHook, StablePairHook and DualPoolHook, saw no permissioned-pools row, and concluded
the contracts have never been audited. They are recommending we stop.

Before I take that recommendation to our risk committee, I want to know:

1. Is that conclusion right? Is there a published review of these contracts or not?
2. If there is, where is it and who wrote it?
3. Can I tell the committee our whole setup is covered by it?
4. Is there any part of our setup that no external review of the Uniswap contracts would cover?

Please be precise about what you know and what I have to go read myself. The committee will ask me
where each claim came from.
