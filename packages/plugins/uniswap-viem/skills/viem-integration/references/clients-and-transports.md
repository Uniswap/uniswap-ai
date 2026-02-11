# Clients and Transports

Detailed reference for viem client setup, transports, and chain configuration.

## PublicClient (Read Operations)

The PublicClient is used for all read-only blockchain operations.

### Basic Setup

```typescript
import { createPublicClient, http } from 'viem';
import { mainnet } from 'viem/chains';

const client = createPublicClient({
  chain: mainnet,
  transport: http(),
});
```

### With Custom RPC

```typescript
const client = createPublicClient({
  chain: mainnet,
  transport: http('https://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY'),
});
```

### Configuration Options

```typescript
const client = createPublicClient({
  chain: mainnet,
  transport: http(),
  batch: {
    multicall: true, // Enable automatic batching via Multicall3
  },
  cacheTime: 4_000, // Cache duration in ms (default: 4000)
  pollingInterval: 4_000, // Polling interval for subscriptions
});
```

---

## WalletClient (Write Operations)

The WalletClient is used for signing and sending transactions.

### With Local Account (Node.js)

```typescript
import { createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { mainnet } from 'viem/chains';

const account = privateKeyToAccount('0x...');

const client = createWalletClient({
  account,
  chain: mainnet,
  transport: http(),
});
```

### With Browser Wallet (Frontend)

```typescript
import { createWalletClient, custom } from 'viem';
import { mainnet } from 'viem/chains';

const client = createWalletClient({
  chain: mainnet,
  transport: custom(window.ethereum!),
});

// Request account access
const [address] = await client.requestAddresses();
```

### Get Addresses

```typescript
// Get all connected addresses
const addresses = await client.getAddresses();

// Request connection (browser wallet)
const addresses = await client.requestAddresses();
```

---

## Transport Types

### HTTP Transport

Standard RPC transport for most use cases.

```typescript
import { http } from 'viem';

// Default (uses chain's public RPC)
http();

// Custom RPC URL
http('https://eth-mainnet.g.alchemy.com/v2/KEY');

// With options
http('https://...', {
  batch: true, // Enable JSON-RPC batching
  fetchOptions: {
    // Custom fetch options
    headers: {
      'x-api-key': 'KEY',
    },
  },
  retryCount: 3, // Retry failed requests
  retryDelay: 150, // Delay between retries (ms)
  timeout: 10_000, // Request timeout (ms)
});
```

### WebSocket Transport

For real-time event subscriptions.

```typescript
import { webSocket } from 'viem';

// Basic
webSocket('wss://eth-mainnet.g.alchemy.com/v2/KEY');

// With options
webSocket('wss://...', {
  keepAlive: true, // Enable keep-alive pings
  reconnect: true, // Auto-reconnect on disconnect
  retryCount: 3,
});
```

### Custom Transport

For browser wallet providers.

```typescript
import { custom } from 'viem';

// MetaMask / injected wallet
custom(window.ethereum!);

// Any EIP-1193 provider
custom(provider);
```

### Fallback Transport

Use multiple transports with automatic failover.

```typescript
import { fallback, http, webSocket } from 'viem';

const transport = fallback([
  webSocket('wss://...'),
  http('https://...'),
  http(), // Public RPC as last resort
]);
```

---

## Chain Configuration

### Built-in Chains

viem includes 50+ chain definitions:

```typescript
import {
  // Mainnets
  mainnet,
  arbitrum,
  arbitrumNova,
  avalanche,
  base,
  blast,
  bsc,
  celo,
  fantom,
  gnosis,
  linea,
  mantle,
  optimism,
  polygon,
  polygonZkEvm,
  scroll,
  zkSync,
  zora,

  // Testnets
  sepolia,
  goerli,
  arbitrumSepolia,
  baseSepolia,
  optimismSepolia,
  polygonMumbai,
} from 'viem/chains';
```

### Chain Properties

Each chain includes:

```typescript
import { mainnet } from 'viem/chains';

mainnet.id; // 1
mainnet.name; // "Ethereum"
mainnet.nativeCurrency; // { name: "Ether", symbol: "ETH", decimals: 18 }
mainnet.rpcUrls; // { default: { http: [...] } }
mainnet.blockExplorers; // { default: { name: "Etherscan", url: "..." } }
```

### Common Chain IDs

| Chain      | ID       | Import      |
| ---------- | -------- | ----------- |
| Ethereum   | 1        | `mainnet`   |
| Arbitrum   | 42161    | `arbitrum`  |
| Optimism   | 10       | `optimism`  |
| Base       | 8453     | `base`      |
| Polygon    | 137      | `polygon`   |
| BNB Chain  | 56       | `bsc`       |
| Avalanche  | 43114    | `avalanche` |
| Blast      | 81457    | `blast`     |
| zkSync Era | 324      | `zkSync`    |
| Linea      | 59144    | `linea`     |
| Scroll     | 534352   | `scroll`    |
| Sepolia    | 11155111 | `sepolia`   |

### Custom Chain Definition

```typescript
import { defineChain } from 'viem';

const myChain = defineChain({
  id: 123456,
  name: 'My Chain',
  nativeCurrency: {
    name: 'My Token',
    symbol: 'MYT',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ['https://rpc.mychain.com'],
    },
  },
  blockExplorers: {
    default: {
      name: 'My Explorer',
      url: 'https://explorer.mychain.com',
    },
  },
});
```

---

## RPC Providers

### Public RPCs

Each chain has a default public RPC (rate-limited):

```typescript
const client = createPublicClient({
  chain: mainnet,
  transport: http(), // Uses public RPC
});
```

### Alchemy

```typescript
const ALCHEMY_KEY = process.env.ALCHEMY_API_KEY;

const client = createPublicClient({
  chain: mainnet,
  transport: http(`https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`),
});

// Chain-specific URLs
// Arbitrum: arb-mainnet.g.alchemy.com/v2/KEY
// Optimism: opt-mainnet.g.alchemy.com/v2/KEY
// Base: base-mainnet.g.alchemy.com/v2/KEY
// Polygon: polygon-mainnet.g.alchemy.com/v2/KEY
```

### Infura

```typescript
const INFURA_KEY = process.env.INFURA_API_KEY;

const client = createPublicClient({
  chain: mainnet,
  transport: http(`https://mainnet.infura.io/v3/${INFURA_KEY}`),
});

// Chain-specific URLs
// Arbitrum: arbitrum-mainnet.infura.io/v3/KEY
// Optimism: optimism-mainnet.infura.io/v3/KEY
// Polygon: polygon-mainnet.infura.io/v3/KEY
```

### QuickNode

```typescript
const client = createPublicClient({
  chain: mainnet,
  transport: http('https://your-endpoint.quiknode.pro/your-key/'),
});
```

---

## Multi-Chain Setup

### Separate Clients

```typescript
import { createPublicClient, http } from 'viem';
import { mainnet, arbitrum, base } from 'viem/chains';

const clients = {
  [mainnet.id]: createPublicClient({
    chain: mainnet,
    transport: http(),
  }),
  [arbitrum.id]: createPublicClient({
    chain: arbitrum,
    transport: http(),
  }),
  [base.id]: createPublicClient({
    chain: base,
    transport: http(),
  }),
};

// Use by chain ID
const balance = await clients[1].getBalance({ address: '0x...' });
```

### Factory Function

```typescript
import { createPublicClient, http, type Chain } from 'viem';
import { mainnet, arbitrum, base } from 'viem/chains';

const chains: Record<number, Chain> = {
  [mainnet.id]: mainnet,
  [arbitrum.id]: arbitrum,
  [base.id]: base,
};

function getClient(chainId: number) {
  const chain = chains[chainId];
  if (!chain) throw new Error(`Unsupported chain: ${chainId}`);

  return createPublicClient({
    chain,
    transport: http(),
  });
}
```

---

## Environment Variables Pattern

Recommended setup for Node.js applications:

```typescript
// config.ts
import { createPublicClient, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { mainnet } from 'viem/chains';

if (!process.env.RPC_URL) {
  throw new Error('RPC_URL environment variable is required');
}

export const publicClient = createPublicClient({
  chain: mainnet,
  transport: http(process.env.RPC_URL),
});

// Only create wallet client if private key is available
export const walletClient = process.env.PRIVATE_KEY
  ? createWalletClient({
      account: privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`),
      chain: mainnet,
      transport: http(process.env.RPC_URL),
    })
  : null;
```

Example `.env`:

```env
RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY
PRIVATE_KEY=0x...
```
