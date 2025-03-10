import { 
  parseEther,
  parseUnits,
  formatUnits,
  type Address, 
  type Hash, 
  type Hex,
  type Abi,
  getContract,
  type Account
} from 'viem';
import { getPublicClient, getWalletClient } from './clients.js';
import { getChain } from '../chains.js';

// Standard ERC20 ABI for transfers
const erc20TransferAbi = [
  {
    inputs: [
      { type: 'address', name: 'to' },
      { type: 'uint256', name: 'amount' }
    ],
    name: 'transfer',
    outputs: [{ type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [
      { type: 'address', name: 'spender' },
      { type: 'uint256', name: 'amount' }
    ],
    name: 'approve',
    outputs: [{ type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [],
    name: 'decimals',
    outputs: [{ type: 'uint8' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'symbol',
    outputs: [{ type: 'string' }],
    stateMutability: 'view',
    type: 'function'
  }
] as const;

// Standard ERC721 ABI for transfers
const erc721TransferAbi = [
  {
    inputs: [
      { type: 'address', name: 'from' },
      { type: 'address', name: 'to' },
      { type: 'uint256', name: 'tokenId' }
    ],
    name: 'transferFrom',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [],
    name: 'name',
    outputs: [{ type: 'string' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'symbol',
    outputs: [{ type: 'string' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ type: 'uint256', name: 'tokenId' }],
    name: 'ownerOf',
    outputs: [{ type: 'address' }],
    stateMutability: 'view',
    type: 'function'
  }
] as const;

// ERC1155 ABI for transfers
const erc1155TransferAbi = [
  {
    inputs: [
      { type: 'address', name: 'from' },
      { type: 'address', name: 'to' },
      { type: 'uint256', name: 'id' },
      { type: 'uint256', name: 'amount' },
      { type: 'bytes', name: 'data' }
    ],
    name: 'safeTransferFrom',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [
      { type: 'address', name: 'account' },
      { type: 'uint256', name: 'id' }
    ],
    name: 'balanceOf',
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  }
] as const;

/**
 * Transfer ETH to an address
 * @param privateKey The private key of the sender
 * @param to The recipient address
 * @param amount The amount to transfer as a human-readable string in ETH (e.g. "0.1" for 0.1 ETH)
 * @param network The network to use
 * @returns Transaction hash
 */
export async function transferETH(
  privateKey: string | Hex,
  to: Address,
  amount: string, // in ether
  network = 'ethereum'
): Promise<Hash> {
  // Ensure the private key has 0x prefix
  const formattedKey = typeof privateKey === 'string' && !privateKey.startsWith('0x')
    ? `0x${privateKey}` as Hex
    : privateKey as Hex;
    
  const client = getWalletClient(formattedKey, network);
  
  // Convert amount from ether to wei
  const value = parseEther(amount);
  
  // Send the transaction
  return await client.sendTransaction({
    to,
    value,
    account: client.account!,
    chain: client.chain
  });
}

/**
 * Transfer ERC20 tokens from one address to another
 * @param tokenAddress The address of the ERC20 token contract
 * @param toAddress The recipient address
 * @param amount The amount to transfer as a human-readable string (e.g. "1.5" for 1.5 tokens)
 * @param privateKey The private key of the sender
 * @param network The network to use
 * @returns Transaction details
 */
export async function transferERC20(
  tokenAddress: Address,
  toAddress: Address,
  amount: string,
  privateKey: string | `0x${string}`,
  network: string = 'ethereum'
): Promise<{
  txHash: Hash;
  amount: {
    raw: bigint;
    formatted: string;
  };
  token: {
    symbol: string;
    decimals: number;
  };
}> {
  // Ensure the private key has 0x prefix
  const formattedKey = typeof privateKey === 'string' && !privateKey.startsWith('0x')
    ? `0x${privateKey}` as Hex
    : privateKey as Hex;

  const publicClient = getPublicClient(network);
  const walletClient = getWalletClient(formattedKey, network);
  const account = walletClient.account!;
  const chain = getChain(network);

  // Get token metadata for proper formatting
  const contract = getContract({
    address: tokenAddress,
    abi: erc20TransferAbi,
    client: publicClient,
  });

  const [decimals, symbol] = await Promise.all([
    contract.read.decimals(),
    contract.read.symbol()
  ]);

  // Convert human-readable amount to token units
  const rawAmount = parseUnits(amount, decimals);

  // Prepare and send the transaction
  const hash = await walletClient.writeContract({
    address: tokenAddress,
    abi: erc20TransferAbi,
    functionName: 'transfer',
    args: [toAddress, rawAmount],
    account,
    chain
  });

  return {
    txHash: hash,
    amount: {
      raw: rawAmount,
      formatted: amount
    },
    token: {
      symbol,
      decimals
    }
  };
}

/**
 * Approve another address to spend a specific amount of tokens
 * @param tokenAddress The address of the ERC20 token contract
 * @param spenderAddress The address to approve for spending
 * @param amount The amount to approve as a human-readable string (e.g. "1.5" for 1.5 tokens)
 * @param privateKey The private key of the token owner
 * @param network The network to use
 * @returns Transaction details
 */
export async function approveERC20(
  tokenAddress: Address,
  spenderAddress: Address,
  amount: string,
  privateKey: string | `0x${string}`,
  network: string = 'ethereum'
): Promise<{
  txHash: Hash;
  amount: {
    raw: bigint;
    formatted: string;
  };
  token: {
    symbol: string;
    decimals: number;
  };
}> {
  // Ensure the private key has 0x prefix
  const formattedKey = typeof privateKey === 'string' && !privateKey.startsWith('0x')
    ? `0x${privateKey}` as Hex
    : privateKey as Hex;

  const publicClient = getPublicClient(network);
  const walletClient = getWalletClient(formattedKey, network);
  const account = walletClient.account!;
  const chain = getChain(network);

  // Get token metadata for proper formatting
  const contract = getContract({
    address: tokenAddress,
    abi: erc20TransferAbi,
    client: publicClient,
  });

  const [decimals, symbol] = await Promise.all([
    contract.read.decimals(),
    contract.read.symbol()
  ]);

  // Convert human-readable amount to token units
  const rawAmount = parseUnits(amount, decimals);

  // Prepare and send the transaction
  const hash = await walletClient.writeContract({
    address: tokenAddress,
    abi: erc20TransferAbi,
    functionName: 'approve',
    args: [spenderAddress, rawAmount],
    account,
    chain
  });

  return {
    txHash: hash,
    amount: {
      raw: rawAmount,
      formatted: amount
    },
    token: {
      symbol,
      decimals
    }
  };
}

/**
 * Transfer ERC721 NFT from one address to another
 */
export async function transferERC721(
  tokenAddress: Address,
  toAddress: Address,
  tokenId: bigint,
  privateKey: string | `0x${string}`,
  network: string = 'ethereum'
): Promise<{
  txHash: Hash;
  tokenId: string;
  token: {
    name: string;
    symbol: string;
  };
}> {
  // Ensure the private key has 0x prefix
  const formattedKey = typeof privateKey === 'string' && !privateKey.startsWith('0x')
    ? `0x${privateKey}` as Hex
    : privateKey as Hex;

  const publicClient = getPublicClient(network);
  const walletClient = getWalletClient(formattedKey, network);
  const account = walletClient.account!;
  const fromAddress = account.address;
  const chain = getChain(network);

  // Get token metadata
  const contract = getContract({
    address: tokenAddress,
    abi: erc721TransferAbi,
    client: publicClient,
  });

  const [name, symbol] = await Promise.all([
    contract.read.name(),
    contract.read.symbol()
  ]);

  // Verify ownership before transfer
  const owner = await contract.read.ownerOf([tokenId]);
  if (owner.toLowerCase() !== fromAddress.toLowerCase()) {
    throw new Error(`Address ${fromAddress} does not own NFT #${tokenId}`);
  }

  // Send the NFT 
  const hash = await walletClient.writeContract({
    address: tokenAddress,
    abi: erc721TransferAbi,
    functionName: 'transferFrom',
    args: [fromAddress, toAddress, tokenId],
    account,
    chain
  });

  return {
    txHash: hash,
    tokenId: tokenId.toString(),
    token: {
      name,
      symbol
    }
  };
}

/**
 * Transfer an ERC1155 token
 * @param tokenAddress The address of the ERC1155 token contract
 * @param toAddress The recipient address
 * @param tokenId The ID of the token to transfer
 * @param amount The amount to transfer as a string (ERC1155 tokens don't typically have decimals, but we use string for consistency)
 * @param privateKey The private key of the sender
 * @param network The network to use
 * @returns Transaction details
 */
export async function transferERC1155(
  tokenAddress: Address,
  toAddress: Address,
  tokenId: bigint,
  amount: string,
  privateKey: string | `0x${string}`,
  network: string = 'ethereum'
): Promise<{
  txHash: Hash;
  tokenId: string;
  amount: string;
}> {
  // Ensure the private key has 0x prefix
  const formattedKey = typeof privateKey === 'string' && !privateKey.startsWith('0x')
    ? `0x${privateKey}` as Hex
    : privateKey as Hex;

  const publicClient = getPublicClient(network);
  const walletClient = getWalletClient(formattedKey, network);
  const account = walletClient.account!;
  const fromAddress = account.address;
  const chain = getChain(network);

  // Convert amount to bigint (ERC1155 tokens typically don't have decimals)
  const amountBigInt = BigInt(amount);

  // Verify balance before transfer
  const contract = getContract({
    address: tokenAddress,
    abi: erc1155TransferAbi,
    client: publicClient,
  });

  const balance = await contract.read.balanceOf([fromAddress, tokenId]);
  if (balance < amountBigInt) {
    throw new Error(`Insufficient balance (${balance.toString()}) for transfer of ${amount} tokens with ID #${tokenId}`);
  }

  // Send the token
  const hash = await walletClient.writeContract({
    address: tokenAddress,
    abi: erc1155TransferAbi,
    functionName: 'safeTransferFrom',
    args: [fromAddress, toAddress, tokenId, amountBigInt, '0x' as `0x${string}`], // empty bytes for data
    account,
    chain
  });

  return {
    txHash: hash,
    tokenId: tokenId.toString(),
    amount: amount
  };
} 