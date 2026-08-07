# Which Contracts Get Registered As Allowed Wrappers

Which contracts do we register with `updateAllowedWrapper`? I'm looking at the deployment addresses
table and it lists six.

Two follow-ups:

1. We are also deploying our own thin router for our internal desk, which will call the pool
   manager directly. Does that change the list?
2. One of my colleagues resolved "Universal Router" from a deployments page and got an address that
   does not match the one in the permissioned-pools table. Which one is right, and how do we make
   sure we pick the right one next time?

Give me the list we should actually register, and say plainly what must not be registered.
