# Package Install Does Not Resolve

I ran `npm i @uniswap/v4-periphery` and the `permissionedPools` import doesn't resolve — the
directory isn't in `node_modules` at all. The docs use
`@uniswap/v4-periphery/src/hooks/permissionedPools/...` in their import lines, so I assumed the
package was the right dependency.

How do I install these contracts?

We build with Foundry. Give me the exact install command, whatever configuration it needs to make
those import paths resolve, and tell me what to pin to and why.
