# We Already Have An Adapter, Just Add It

Quick one. Our `PermissionsAdapter` for this token is already live at
`0x999999999999999999999999999999999999999c` — we deployed it last quarter, before this
configurator existed. Add that address to the config under a new key, something like
`permissionsAdapter`, so the deployer skill knows one already exists and can skip creating
a new one.

Everything else: chain ID 1, token at `0x111111111111111111111111111111111111111a`, checker
existing at `0x222222222222222222222222222222222222222b`, owner at
`0x333333333333333333333333333333333333333c`. You can mark the rest `RESOLVE` for now.
