# Wagmi React

Reference for React/wagmi hooks for building frontend blockchain applications.

## Setup

### Installation

```bash
npm install wagmi viem @tanstack/react-query
```

### Configuration

```typescript
// config.ts
import { createConfig, http } from 'wagmi';
import { mainnet, arbitrum, optimism, base, polygon } from 'wagmi/chains';
import { injected, walletConnect, coinbaseWallet } from 'wagmi/connectors';

const projectId = 'YOUR_WALLETCONNECT_PROJECT_ID';

export const config = createConfig({
  chains: [mainnet, arbitrum, optimism, base, polygon],
  connectors: [injected(), walletConnect({ projectId }), coinbaseWallet({ appName: 'My App' })],
  transports: {
    [mainnet.id]: http(),
    [arbitrum.id]: http(),
    [optimism.id]: http(),
    [base.id]: http(),
    [polygon.id]: http(),
  },
});

// Type declaration for TypeScript
declare module 'wagmi' {
  interface Register {
    config: typeof config;
  }
}
```

### Provider Setup

```tsx
// App.tsx
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { config } from './config';

const queryClient = new QueryClient();

function App({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
```

---

## Wallet Connection

### useAccount

Get current account status and address:

```tsx
import { useAccount } from 'wagmi';

function Profile() {
  const { address, isConnected, isConnecting, isDisconnected, chain } = useAccount();

  if (isConnecting) return <div>Connecting...</div>;
  if (isDisconnected) return <div>Disconnected</div>;

  return (
    <div>
      <p>Address: {address}</p>
      <p>Chain: {chain?.name}</p>
    </div>
  );
}
```

### useConnect

Connect to a wallet:

```tsx
import { useConnect } from 'wagmi';

function WalletOptions() {
  const { connect, connectors, isPending, error } = useConnect();

  return (
    <div>
      {connectors.map((connector) => (
        <button key={connector.uid} onClick={() => connect({ connector })} disabled={isPending}>
          {connector.name}
        </button>
      ))}
      {error && <div>Error: {error.message}</div>}
    </div>
  );
}
```

### useDisconnect

Disconnect wallet:

```tsx
import { useDisconnect } from 'wagmi';

function DisconnectButton() {
  const { disconnect } = useDisconnect();

  return <button onClick={() => disconnect()}>Disconnect</button>;
}
```

### Complete Connect Flow

```tsx
import { useAccount, useConnect, useDisconnect } from 'wagmi';

function ConnectWallet() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();

  if (isConnected) {
    return (
      <div>
        <p>{address}</p>
        <button onClick={() => disconnect()}>Disconnect</button>
      </div>
    );
  }

  return (
    <div>
      {connectors.map((connector) => (
        <button key={connector.uid} onClick={() => connect({ connector })} disabled={isPending}>
          Connect {connector.name}
        </button>
      ))}
    </div>
  );
}
```

---

## Reading Data

### useBalance

Get ETH or token balance:

```tsx
import { useBalance } from 'wagmi';

function Balance() {
  const { data, isLoading, error } = useBalance({
    address: '0x...',
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      Balance: {data?.formatted} {data?.symbol}
    </div>
  );
}

// Token balance
function TokenBalance() {
  const { data } = useBalance({
    address: '0xUserAddress',
    token: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
  });

  return <div>USDC: {data?.formatted}</div>;
}
```

### useReadContract

Read from a smart contract:

```tsx
import { useReadContract } from 'wagmi';
import { parseAbi } from 'viem';

const abi = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function totalSupply() view returns (uint256)',
]);

function TokenInfo() {
  const { data: balance } = useReadContract({
    address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    abi,
    functionName: 'balanceOf',
    args: ['0xUserAddress'],
  });

  const { data: totalSupply } = useReadContract({
    address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    abi,
    functionName: 'totalSupply',
  });

  return (
    <div>
      <p>Balance: {balance?.toString()}</p>
      <p>Total Supply: {totalSupply?.toString()}</p>
    </div>
  );
}
```

### useReadContracts (Batch)

Read multiple contracts in one request:

```tsx
import { useReadContracts } from 'wagmi';

const usdcContract = {
  address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  abi: erc20Abi,
} as const;

function MultipleReads() {
  const { data } = useReadContracts({
    contracts: [
      { ...usdcContract, functionName: 'name' },
      { ...usdcContract, functionName: 'symbol' },
      { ...usdcContract, functionName: 'decimals' },
      { ...usdcContract, functionName: 'balanceOf', args: ['0x...'] },
    ],
  });

  const [name, symbol, decimals, balance] = data || [];

  return (
    <div>
      <p>Name: {name?.result}</p>
      <p>Symbol: {symbol?.result}</p>
      <p>Decimals: {decimals?.result}</p>
      <p>Balance: {balance?.result?.toString()}</p>
    </div>
  );
}
```

---

## Writing Data

### useWriteContract

Write to a smart contract:

```tsx
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits } from 'viem';

function TransferToken() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const handleTransfer = () => {
    writeContract({
      address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      abi: erc20Abi,
      functionName: 'transfer',
      args: ['0xRecipient', parseUnits('100', 6)],
    });
  };

  return (
    <div>
      <button onClick={handleTransfer} disabled={isPending}>
        {isPending ? 'Confirming...' : 'Transfer'}
      </button>

      {isConfirming && <div>Waiting for confirmation...</div>}
      {isSuccess && <div>Transaction confirmed!</div>}
      {error && <div>Error: {error.message}</div>}
    </div>
  );
}
```

### useSendTransaction

Send native token (ETH):

```tsx
import { useSendTransaction, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther } from 'viem';

function SendEth() {
  const { sendTransaction, data: hash, isPending } = useSendTransaction();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  return (
    <button
      onClick={() =>
        sendTransaction({
          to: '0xRecipient',
          value: parseEther('0.1'),
        })
      }
      disabled={isPending || isConfirming}
    >
      {isPending ? 'Confirming...' : isConfirming ? 'Processing...' : 'Send 0.1 ETH'}
    </button>
  );
}
```

### useSimulateContract

Simulate before writing:

```tsx
import { useSimulateContract, useWriteContract } from 'wagmi';

function SafeTransfer() {
  const { data: simulation, error: simError } = useSimulateContract({
    address: '0x...',
    abi: erc20Abi,
    functionName: 'transfer',
    args: ['0x...', parseUnits('100', 6)],
  });

  const { writeContract, isPending } = useWriteContract();

  return (
    <div>
      {simError && <div>Simulation failed: {simError.message}</div>}
      <button
        onClick={() => simulation && writeContract(simulation.request)}
        disabled={!simulation || isPending}
      >
        Transfer
      </button>
    </div>
  );
}
```

---

## Chain Management

### useChainId

Get current chain ID:

```tsx
import { useChainId } from 'wagmi';

function CurrentChain() {
  const chainId = useChainId();
  return <div>Chain ID: {chainId}</div>;
}
```

### useSwitchChain

Switch to a different chain:

```tsx
import { useSwitchChain, useChainId } from 'wagmi';

function ChainSwitcher() {
  const chainId = useChainId();
  const { chains, switchChain, isPending, error } = useSwitchChain();

  return (
    <div>
      <p>Current Chain: {chainId}</p>
      {chains.map((chain) => (
        <button
          key={chain.id}
          onClick={() => switchChain({ chainId: chain.id })}
          disabled={chain.id === chainId || isPending}
        >
          {chain.name}
        </button>
      ))}
      {error && <div>Error: {error.message}</div>}
    </div>
  );
}
```

---

## Message Signing

### useSignMessage

Sign a message:

```tsx
import { useSignMessage } from 'wagmi';

function SignMessage() {
  const { signMessage, data: signature, isPending, error } = useSignMessage();

  return (
    <div>
      <button onClick={() => signMessage({ message: 'Hello, World!' })} disabled={isPending}>
        Sign Message
      </button>
      {signature && <div>Signature: {signature}</div>}
      {error && <div>Error: {error.message}</div>}
    </div>
  );
}
```

### useSignTypedData

Sign EIP-712 typed data:

```tsx
import { useSignTypedData } from 'wagmi';

function SignTypedData() {
  const { signTypedData, data: signature } = useSignTypedData();

  const handleSign = () => {
    signTypedData({
      domain: {
        name: 'My App',
        version: '1',
        chainId: 1,
        verifyingContract: '0x...',
      },
      types: {
        Person: [
          { name: 'name', type: 'string' },
          { name: 'wallet', type: 'address' },
        ],
      },
      primaryType: 'Person',
      message: {
        name: 'Bob',
        wallet: '0x...',
      },
    });
  };

  return <button onClick={handleSign}>Sign Typed Data</button>;
}
```

---

## ENS

### useEnsName

Resolve address to ENS name:

```tsx
import { useEnsName } from 'wagmi';

function EnsName({ address }: { address: `0x${string}` }) {
  const { data: ensName } = useEnsName({ address });

  return <div>{ensName || address}</div>;
}
```

### useEnsAddress

Resolve ENS name to address:

```tsx
import { useEnsAddress } from 'wagmi';

function EnsAddress({ name }: { name: string }) {
  const { data: address } = useEnsAddress({ name });

  return <div>{address}</div>;
}
```

### useEnsAvatar

Get ENS avatar:

```tsx
import { useEnsAvatar, useEnsName } from 'wagmi';

function Profile({ address }: { address: `0x${string}` }) {
  const { data: ensName } = useEnsName({ address });
  const { data: ensAvatar } = useEnsAvatar({ name: ensName! });

  return (
    <div>
      {ensAvatar && <img src={ensAvatar} alt="Avatar" />}
      <span>{ensName || address}</span>
    </div>
  );
}
```

---

## Hook Reference Table

| Hook                           | Purpose                            |
| ------------------------------ | ---------------------------------- |
| **Connection**                 |                                    |
| `useAccount`                   | Get account status, address, chain |
| `useConnect`                   | Connect to a wallet                |
| `useDisconnect`                | Disconnect wallet                  |
| `useConnectors`                | Get available connectors           |
| **Reading**                    |                                    |
| `useBalance`                   | Get ETH/token balance              |
| `useReadContract`              | Read contract function             |
| `useReadContracts`             | Batch read multiple contracts      |
| `useBlockNumber`               | Get current block number           |
| `useGasPrice`                  | Get current gas price              |
| **Writing**                    |                                    |
| `useWriteContract`             | Write to contract                  |
| `useSendTransaction`           | Send native token                  |
| `useSimulateContract`          | Simulate contract call             |
| `useWaitForTransactionReceipt` | Wait for tx confirmation           |
| **Chain**                      |                                    |
| `useChainId`                   | Get current chain ID               |
| `useSwitchChain`               | Switch networks                    |
| `usePublicClient`              | Get viem public client             |
| `useWalletClient`              | Get viem wallet client             |
| **Signing**                    |                                    |
| `useSignMessage`               | Sign a message                     |
| `useSignTypedData`             | Sign EIP-712 typed data            |
| **ENS**                        |                                    |
| `useEnsName`                   | Resolve address to ENS             |
| `useEnsAddress`                | Resolve ENS to address             |
| `useEnsAvatar`                 | Get ENS avatar                     |

---

## Best Practices

### Loading States

```tsx
function DataComponent() {
  const { data, isLoading, isError, error } = useReadContract({...})

  if (isLoading) return <Skeleton />
  if (isError) return <Error message={error.message} />
  if (!data) return null

  return <div>{data.toString()}</div>
}
```

### Error Boundaries

```tsx
import { useAccount, useConnect } from 'wagmi';

function WalletStatus() {
  const { isConnected } = useAccount();
  const { error } = useConnect();

  if (error) {
    // Handle specific errors
    if (error.message.includes('User rejected')) {
      return <div>Connection cancelled</div>;
    }
    return <div>Connection error: {error.message}</div>;
  }

  return <div>{isConnected ? 'Connected' : 'Not connected'}</div>;
}
```

### Refresh Data

```tsx
import { useQueryClient } from '@tanstack/react-query';
import { useBalance } from 'wagmi';

function BalanceWithRefresh({ address }: { address: `0x${string}` }) {
  const queryClient = useQueryClient();
  const { data, queryKey } = useBalance({ address });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey });
  };

  return (
    <div>
      <span>{data?.formatted}</span>
      <button onClick={refresh}>Refresh</button>
    </div>
  );
}
```
