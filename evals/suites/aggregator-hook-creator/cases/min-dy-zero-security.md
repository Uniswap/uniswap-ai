# Is min_dy = 0 Safe?

I am reviewing an aggregator hook that calls a Curve pool's `exchange` with `min_dy` set to 0 and measures the output with a balance difference. A teammate says this is a critical slippage bug and wants the hook to enforce a TWAP check and a minimum output on-chain.

Is the teammate right? Explain when `min_dy = 0` is acceptable, what must be true for it to be safe, and which checks the hook should do instead.
