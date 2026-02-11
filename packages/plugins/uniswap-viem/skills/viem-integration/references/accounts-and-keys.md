# Accounts and Keys

Reference for private key management, HD wallets, and message signing with viem.

## Private Key Account

### Basic Usage

```typescript
import { privateKeyToAccount } from 'viem/accounts';

const account = privateKeyToAccount(
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
);

console.log(account.address); // 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
```

### With WalletClient

```typescript
import { createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { mainnet } from 'viem/chains';

const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);

const client = createWalletClient({
  account,
  chain: mainnet,
  transport: http(),
});
```

### Generate New Private Key

```typescript
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';

const privateKey = generatePrivateKey();
const account = privateKeyToAccount(privateKey);

console.log('Private Key:', privateKey);
console.log('Address:', account.address);
```

---

## Mnemonic / HD Wallet

### Create Account from Mnemonic

```typescript
import { mnemonicToAccount } from 'viem/accounts';

const account = mnemonicToAccount(
  'legal winner thank year wave sausage worth useful legal winner thank yellow'
);

console.log(account.address); // Default path: m/44'/60'/0'/0/0
```

### Custom Derivation Path

```typescript
import { mnemonicToAccount } from 'viem/accounts';

// Different account indices
const account0 = mnemonicToAccount(mnemonic, { addressIndex: 0 }); // m/44'/60'/0'/0/0
const account1 = mnemonicToAccount(mnemonic, { addressIndex: 1 }); // m/44'/60'/0'/0/1
const account2 = mnemonicToAccount(mnemonic, { addressIndex: 2 }); // m/44'/60'/0'/0/2

// Custom account path
const account = mnemonicToAccount(mnemonic, {
  accountIndex: 1, // m/44'/60'/1'/0/0
});

// Full custom path
const account = mnemonicToAccount(mnemonic, {
  path: "m/44'/60'/0'/1/5",
});
```

### Generate New Mnemonic

```typescript
import { generateMnemonic, english, mnemonicToAccount } from 'viem/accounts';

// Generate 12-word mnemonic
const mnemonic = generateMnemonic(english);

// Generate 24-word mnemonic
const mnemonic24 = generateMnemonic(english, 256);

const account = mnemonicToAccount(mnemonic);
```

### Other Languages

```typescript
import {
  generateMnemonic,
  english,
  spanish,
  french,
  italian,
  japanese,
  korean,
  simplifiedChinese,
  traditionalChinese,
  czech,
  portuguese,
} from 'viem/accounts';

const mnemonic = generateMnemonic(spanish);
```

---

## HD Key Derivation

### From Master Seed

```typescript
import { HDKey, hdKeyToAccount } from 'viem/accounts';

// From seed (Buffer/Uint8Array)
const hdKey = HDKey.fromMasterSeed(seed);
const account = hdKeyToAccount(hdKey);
```

### From Extended Key

```typescript
import { HDKey, hdKeyToAccount } from 'viem/accounts';

// From xpriv/xpub
const hdKey = HDKey.fromExtendedKey('xprv9s21ZrQH143K...');
const account = hdKeyToAccount(hdKey);
```

### Derive Child Keys

```typescript
import { HDKey, hdKeyToAccount } from 'viem/accounts';

const masterKey = HDKey.fromMasterSeed(seed);

// Derive specific path
const childKey = masterKey.derive("m/44'/60'/0'/0/0");
const account = hdKeyToAccount(childKey);

// Multiple accounts
const accounts = Array.from({ length: 10 }, (_, i) => {
  const child = masterKey.derive(`m/44'/60'/0'/0/${i}`);
  return hdKeyToAccount(child);
});
```

---

## Message Signing

### Personal Sign (EIP-191)

```typescript
import { privateKeyToAccount } from 'viem/accounts';

const account = privateKeyToAccount('0x...');

// Sign a message
const signature = await account.signMessage({
  message: 'Hello, World!',
});

// Sign raw bytes
const signature = await account.signMessage({
  message: { raw: '0x68656c6c6f' },
});
```

### Verify Message Signature

```typescript
import { createPublicClient, http, verifyMessage } from 'viem';
import { mainnet } from 'viem/chains';

const client = createPublicClient({
  chain: mainnet,
  transport: http(),
});

const valid = await client.verifyMessage({
  address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
  message: 'Hello, World!',
  signature: '0x...',
});
```

### Typed Data Signing (EIP-712)

```typescript
import { privateKeyToAccount } from 'viem/accounts';

const account = privateKeyToAccount('0x...');

const signature = await account.signTypedData({
  domain: {
    name: 'My App',
    version: '1',
    chainId: 1,
    verifyingContract: '0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC',
  },
  types: {
    Person: [
      { name: 'name', type: 'string' },
      { name: 'wallet', type: 'address' },
    ],
    Mail: [
      { name: 'from', type: 'Person' },
      { name: 'to', type: 'Person' },
      { name: 'contents', type: 'string' },
    ],
  },
  primaryType: 'Mail',
  message: {
    from: {
      name: 'Alice',
      wallet: '0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826',
    },
    to: {
      name: 'Bob',
      wallet: '0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB',
    },
    contents: 'Hello, Bob!',
  },
});
```

### Verify Typed Data

```typescript
import { verifyTypedData } from 'viem'

const valid = await client.verifyTypedData({
  address: '0x...',
  domain: { ... },
  types: { ... },
  primaryType: 'Mail',
  message: { ... },
  signature: '0x...'
})
```

---

## Transaction Signing

### Sign Transaction

```typescript
import { privateKeyToAccount } from 'viem/accounts';
import { parseEther } from 'viem';

const account = privateKeyToAccount('0x...');

const signedTx = await account.signTransaction({
  chainId: 1,
  to: '0x...',
  value: parseEther('1'),
  maxFeePerGas: parseGwei('50'),
  maxPriorityFeePerGas: parseGwei('2'),
  nonce: 0,
  gas: 21000n,
});

// signedTx is a serialized signed transaction
```

---

## Account Properties

### LocalAccount Interface

```typescript
const account = privateKeyToAccount('0x...');

account.address; // 0x... (checksummed address)
account.publicKey; // 0x... (uncompressed public key)
account.source; // 'privateKey' | 'mnemonic' | 'hd'
account.type; // 'local'

// Methods
account.signMessage({ message });
account.signTransaction(tx);
account.signTypedData(typedData);
```

---

## Security Best Practices

### Environment Variables

```typescript
// NEVER hardcode private keys
// BAD:
const account = privateKeyToAccount('0xac0974bec...');

// GOOD:
if (!process.env.PRIVATE_KEY) {
  throw new Error('PRIVATE_KEY environment variable is required');
}
const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);
```

### .env File

```env
# .env (add to .gitignore!)
PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
MNEMONIC=legal winner thank year wave sausage worth useful legal winner thank yellow
```

### .gitignore

```gitignore
.env
.env.local
.env.*.local
*.key
*.pem
```

### Separate Accounts

```typescript
// Use different accounts for different purposes
const config = {
  development: {
    // Use test accounts with test ETH
    privateKey: process.env.DEV_PRIVATE_KEY,
  },
  production: {
    // Production account with real funds
    privateKey: process.env.PROD_PRIVATE_KEY,
  },
};

const account = privateKeyToAccount(
  config[process.env.NODE_ENV || 'development'].privateKey as `0x${string}`
);
```

### Minimal Permissions

```typescript
// For read-only operations, don't load private key
const publicClient = createPublicClient({
  chain: mainnet,
  transport: http(),
});

// Only create wallet client when needed
let walletClient: WalletClient | null = null;

function getWalletClient() {
  if (!walletClient) {
    const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);
    walletClient = createWalletClient({
      account,
      chain: mainnet,
      transport: http(),
    });
  }
  return walletClient;
}
```

---

## Testing Accounts

### Foundry/Anvil Test Accounts

These accounts are funded in local development environments:

```typescript
// Anvil default accounts (DO NOT USE IN PRODUCTION)
const testAccounts = [
  {
    address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
    privateKey: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
  },
  {
    address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    privateKey: '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d',
  },
  // ... more accounts
];

// Test mnemonic (DO NOT USE IN PRODUCTION)
const testMnemonic = 'test test test test test test test test test test test junk';
```

### Create Test Account Helper

```typescript
function createTestAccount(index: number = 0) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Cannot use test accounts in production');
  }

  return mnemonicToAccount('test test test test test test test test test test test junk', {
    addressIndex: index,
  });
}
```
