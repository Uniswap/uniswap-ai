# Wagmi React Hook Setup Test Case

Set up a React application with wagmi hooks for wallet connection and token balance display.

## Context

- React/Next.js frontend application
- Need to connect browser wallets (MetaMask, WalletConnect, Coinbase Wallet)
- Display connected account's ERC-20 token balance (USDC)
- Support multiple chains (Ethereum mainnet, Arbitrum, Base)

## Requirements

1. Create a wagmi config with createConfig, multiple chains, and connectors (injected, walletConnect, coinbaseWallet)
2. Set up WagmiProvider and QueryClientProvider in the app root
3. Build a wallet connection component using useAccount and useConnect hooks
4. Read an ERC-20 token balance using useReadContract with a parsed ABI
5. Display loading, error, and success states correctly
6. Include TypeScript types (Register interface for wagmi config)

## Constraints

- Must use wagmi (not raw viem) for React hooks
- Must use @tanstack/react-query as a peer dependency
- Must import chains from 'wagmi/chains' and connectors from 'wagmi/connectors'
- Must handle wallet connection states (connecting, connected, disconnected)
- Should follow wagmi best practices for loading and error states

## Expected Output

A working React/TypeScript code example that configures wagmi with multiple chains and connectors, wraps the app in the required providers, connects a wallet, and reads a token balance using wagmi hooks.
