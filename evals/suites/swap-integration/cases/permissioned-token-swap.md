# Swapping A Token That Has A Holder Allowlist

We are adding swap support to our app for a tokenized real-world-asset token. The issuer told us the token "has an allowlist" and that not every wallet is allowed to trade it, but they did not explain what that means for our integration.

What we need:

1. Before we show a quote, how do we find out whether this token has that restriction and whether the connected wallet is allowed to trade it?
2. What should the UI do when the wallet is not allowed? Our designer wants to hide the token entirely; our PM wants to show the price. Tell us which is right and why.
3. Give us the request we should send, with the headers, as working TypeScript using `fetch`.
4. Is there anything different about the quote and swap calls for this kind of token compared with an ordinary ERC-20?

Our current integration already does check_approval, quote and swap for normal tokens. Tell us only what changes.
