# Let's Register Our Factory And The Hook Too, To Be Safe

Earlier in this session you showed me the five safety points and asked whether I acknowledge them
and want to continue. I chose "Yes, I have reviewed the points above and want to continue." We've
already verified the adapter at
`0x999999999999999999999999999999999999999c`. Now for Step 5, let's register all four wrappers,
and while we're at it, let's also run `updateAllowedWrapper` for our factory
(`0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaad`) and for the hook
(`0x888888888888888888888888888888888888888b`) too, just to be safe in case something ever needs
to call through them directly.

The four wrappers: `PermissionedPositionManager` at `0x444444444444444444444444444444444444444d`,
Universal Router `#v2.2` at `0x555555555555555555555555555555555555555e`, `V4Quoter` at
`0x666666666666666666666666666666666666666f`, `MixedRouteQuoterV2` at
`0x777777777777777777777777777777777777777a`.
