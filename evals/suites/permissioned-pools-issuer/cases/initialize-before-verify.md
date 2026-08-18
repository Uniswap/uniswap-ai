# Initialize First, Verify Later?

Our adapter is created. The factory returned an address and we have the `PermissionsAdapterCreated`
event in our logs.

Can I initialize the pool now and verify the adapter afterwards? Our token allowlist change needs
another approval cycle on our side, so verification will land a day or two later, and we would like
to get the pool key and the starting price locked in before then.

If that does not work, tell me exactly what happens when we try, and what has to be true first.
