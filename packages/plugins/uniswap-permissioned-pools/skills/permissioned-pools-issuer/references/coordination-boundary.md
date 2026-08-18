# Permissionless vs Uniswap-Coordinated

Bringing a permissioned pool up has two kinds of steps: the ones you do yourself, whenever you
like, and the ones that involve Uniswap Labs. Teams routinely misjudge where the line falls in both
directions — either waiting for approval that is not required, or assuming that a working pool
appears in the Uniswap interface automatically.

**The on-chain path has no Uniswap approval gate.** Every contract call in the setup sequence is
callable by you, today, on any chain where the contracts are deployed. Nothing in it waits on
anybody.

What is coordinated is **discovery and routing in Uniswap's own products** — the interface and the
API. That is a separate request, made through a published form, and it is the only step in the
journey with a person on the other end.

---

## The boundary

| Permissionless / issuer-controlled                                        | Coordinated with Uniswap Labs                        |
| ------------------------------------------------------------------------- | ---------------------------------------------------- |
| Deploying your allowlist checker                                          | Routing eligibility in the Uniswap interface and API |
| `createPermissionsAdapter` on the factory (anyone may call)               | Token-list inclusion                                 |
| Allowlisting the adapter on your own token                                | Token-detail metadata for the asset                  |
| `depositForVerification` (anyone may call)                                | Issuer name and KYC URL in the backend configuration |
| `verifyPermissionsAdapter` (anyone may call, one-shot)                    |                                                      |
| `updateAllowListChecker`, `updateAllowedWrapper`, `updateSwappingEnabled` |                                                      |
| `setAllowedHook` on the position manager                                  |                                                      |
| Creating and initializing the pool                                        |                                                      |
| Seeding and managing liquidity                                            |                                                      |
| Running your own front end against the pool                               |                                                      |
| Quoting and swapping through registered wrappers                          |                                                      |

Notes on the left column that surprise people:

- **The factory is not gatekept.** `createPermissionsAdapter` and `verifyPermissionsAdapter` have no
  caller authorization at all, and the factory has no owner and no setters. Verification is not a
  review by anyone; it attests that the adapter holds a non-zero balance of its permissioned token,
  which only you can arrange by allowlisting the adapter on your own token.
- **Verification is irreversible.** A second `verifyPermissionsAdapter` call reverts. No party can
  un-verify an adapter.
- **A pool can be live and functional with nobody's involvement but yours.** Swaps and liquidity
  work through any registered wrapper as soon as the on-chain sequence is complete.

Notes on the right column:

- **It is about Uniswap's surfaces, not about your pool.** Nothing in the right column changes what
  the contracts do.
- **It applies per network.** See below — including testnets.

---

## The routing request

Once the adapter is created and verified, routing eligibility in the Uniswap interface and API is
requested through a first-party form in the developer portal.

| Purpose                                                                    | Where                                                         |
| -------------------------------------------------------------------------- | ------------------------------------------------------------- |
| **Request routing allowlisting** — a deployed, verified permissioned token | <https://developers.uniswap.org/permissioned-pools-allowlist> |
| Register interest — still exploring, want the team to reach out            | <https://developers.uniswap.org/permissioned-pools>           |

Both are pages in the Uniswap developer portal, not third-party forms. The first is the one the
deploy guide's Step 7 links; the second exists for teams who have not deployed yet.

### What the form asks for

The deploy guide lists three values that end up in the backend configuration:

- the **permissioned token address** (the token wallets hold),
- the **verified adapter address** (created in the guide's Step 2, verified in Step 4),
- a **KYC URL**, where users who are not yet approved complete verification.

The form itself asks for more than those three. It has **thirteen fields plus a terms-and-privacy
consent checkbox**, and everything except _Last name_ and _Notes_ is required:

| Field                                   | Required |
| --------------------------------------- | -------- |
| First name                              | yes      |
| Last name                               | no       |
| Email                                   | yes      |
| Telegram handle                         | yes      |
| Company                                 | yes      |
| Company location                        | yes      |
| Token issuer                            | yes      |
| Chain or chains                         | yes      |
| CoinGecko API link, for your token logo | yes      |
| Permissioned token address              | yes      |
| Verified adapter address                | yes      |
| KYC URL                                 | yes      |
| Notes                                   | no       |
| Terms and privacy consent               | yes      |

Two of the required fields are not mentioned anywhere in the guide: the **Telegram handle** and the
**CoinGecko API link for the token logo**. Both take time to produce if you have not thought about
them — a monitored Telegram handle is an organizational decision, and a CoinGecko listing is an
external process with its own timeline. Sort them out before you open the form rather than
mid-submission.

The backend configuration entry the guide shows is **keyed by the permissioned token address,
lowercased**, and carries the adapter address, the KYC URL, and an issuer name. Where the adapter
and the permissioned token are the same address, the token already behaves as its own adapter.

### It applies on testnets too

The guide states that allowlisting is required on **every network, including mainnet and Sepolia**.
Testnet routing in the Uniswap interface is not self-serve. If your plan includes an end-to-end
rehearsal through the Uniswap interface on a testnet before mainnet, the request has to be made for
that network as well, and it is a separate submission.

Your own front end, your own quoting, and your own swap path need none of this on any network.

### Timing

This step is coordinated with Uniswap Labs through the published request form. Timelines,
eligibility, and outcomes are not defined by the contracts and are not something this skill can
commit to on Uniswap Labs' behalf.

Stated factually: the guide says the team follows up to complete onboarding, and the form's
confirmation screen says the team will be in touch shortly. **No turnaround time, business-day
window, or escalation path is published.** Plan a launch that does not depend on one — submit as
early as the form's own precondition allows (a deployed, verified token), and keep the parts of the
launch that need a date on the left-hand column of the table above, which you control.

---

## What routing eligibility does and does not cover

Worth separating explicitly, because "listed in the app" bundles several different things:

| Outcome                                         | Depends on                                   |
| ----------------------------------------------- | -------------------------------------------- |
| The pool exists, swaps, and accepts liquidity   | your on-chain setup only                     |
| Your own interface can quote and route          | your integration plus registered wrappers    |
| The Uniswap interface and API route to the pool | the routing request                          |
| The asset appears in a token list               | token-list inclusion, requested separately   |
| Token detail and metadata render for the asset  | metadata configuration, requested separately |
| A price renders wherever the asset appears      | product behaviour outside the contracts      |

That last row is the one to be careful about in a launch plan. **Appearing in the Uniswap interface,
and having prices render for a permissioned asset, are separate from the pool being live and
functional on-chain.** They involve different systems and different data sources. Verify the
end-state you actually need in the surface you need it in, on a testnet if you can, rather than
inferring it from a working pool.

---

## Common misreadings of the boundary

Each of these comes up, and each has a one-line answer from the two columns above.

- **"We need Uniswap to create our adapter."** No. `createPermissionsAdapter` is callable by anyone,
  and the `initialOwner` argument you pass is the owner from the first block.
- **"We need Uniswap to verify the adapter."** No. `verifyPermissionsAdapter` is callable by anyone
  and checks a token balance, not a submission. What it needs from you is the adapter allowlisted on
  your own token and holding a non-zero balance.
- **"We should wait for routing approval before creating the pool."** The order is the other way
  around: the routing form's precondition is a deployed, verified token, so the on-chain work comes
  first.
- **"Routing on Sepolia is automatic because it is a testnet."** No — the request is required on
  every network.
- **"The pool is not really live until it shows in the Uniswap app."** It is live as soon as the
  on-chain sequence is complete. Appearing in a given surface is a separate outcome.
- **"Uniswap can freeze or un-verify our adapter."** Verification cannot be reversed and the factory
  has no owner and no setters. The powers that exist over a live pool sit with the adapter owner —
  see [Trust Model](./trust-model.md).

---

## Planning checklist

Use this to sort your own launch tasks into the two columns.

**Before you touch the form**

1. Is the adapter created and verified? The routing form's stated precondition is a deployed,
   verified permissioned token.
2. Do you have a KYC URL that is live and that an unapproved user can actually complete?
3. Do you have a monitored Telegram handle and a CoinGecko API link for the token logo?
4. Which networks do you need routing on? One submission per network.

**Independent of the form — do not block on it**

1. The whole on-chain sequence, up to and including seeded liquidity and enabled swapping.
2. Your own front end, quoting, and any custom router (registered as an allowed wrapper — see
   [Trust Model](./trust-model.md)).
3. Your allowlist operations: onboarding holders, granting `LIQUIDITY_ALLOWED` to the wallets that
   will provide liquidity, and whatever process you run for changes.
4. Your internal runbooks for the adapter-owner operations, including the force-exit path.

**Communicating with your own LPs and holders**

1. Positions are non-transferable, and the pool never gates the exit — though delivery of the
   permissioned side lands only at an address your token permits.
   [The pool never gates the exit](./trust-model.md#the-pool-never-gates-the-exit) has the mechanics
   and the product consequences.
2. Either adapter admin can force-exit a position, and where the proceeds go depends on the
   currency.
3. Which surfaces the asset will and will not appear in at launch, per the table above.

---

## What this file does not tell you

- **Whether a given request will be approved, or on what criteria.** Eligibility is not defined by
  the contracts, and nothing published states it. Ask through the form.
- **Anything about specific issuers or launches.** This skill does not name or characterize other
  issuers' pools, tokens, or configurations.
- **Whether your allowlist design, your checker, or your operating model is adequate** for your
  obligations. That is a question for your own counsel and your own reviewers; this skill covers
  contract mechanics only.

Related reading: [Issuer Journey](./issuer-journey.md) for the ordered on-chain sequence including
the routing step in context, and [Packaging and Sources](./packaging-and-sources.md) for where to
resolve every address the form asks for.
