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
 */
export async function transferETH(
  privateKey: Hex,
  to: Address,
  amount: string, // in ether
  network = 'ethereum'
): Promise<Hash> {
  const client = getWalletClient(privateKey, network);
  
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
 */
export async function transferERC20(
  tokenAddress: Address,
  toAddress: Address,
  amount: string,
  privateKey: `0x${string}`,
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
  const publicClient = getPublicClient(network);
  const walletClient = getWalletClient(privateKey, network);
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
 */
export async function approveERC20(
  tokenAddress: Address,
  spenderAddress: Address,
  amount: string,
  privateKey: `0x${string}`,
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
  const publicClient = getPublicClient(network);
  const walletClient = getWalletClient(privateKey, network);
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
  privateKey: `0x${string}`,
  network: string = 'ethereum'
): Promise<{
  txHash: Hash;
  tokenId: string;
  token: {
    name: string;
    symbol: string;
  };
}> {
  const publicClient = getPublicClient(network);
  const walletClient = getWalletClient(privateKey, network);
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
 */
export async function transferERC1155(
  tokenAddress: Address,
  toAddress: Address,
  tokenId: bigint,
  amount: bigint,
  privateKey: `0x${string}`,
  network: string = 'ethereum'
): Promise<{
  txHash: Hash;
  tokenId: string;
  amount: string;
}> {
  const publicClient = getPublicClient(network);
  const walletClient = getWalletClient(privateKey, network);
  const account = walletClient.account!;
  const fromAddress = account.address;
  const chain = getChain(network);

  // Verify balance before transfer
  const contract = getContract({
    address: tokenAddress,
    abi: erc1155TransferAbi,
    client: publicClient,
  });

  const balance = await contract.read.balanceOf([fromAddress, tokenId]);
  if (balance < amount) {
    throw new Error(`Insufficient balance (${balance.toString()}) for transfer of ${amount.toString()} tokens with ID #${tokenId}`);
  }

  // Send the token
  const hash = await walletClient.writeContract({
    address: tokenAddress,
    abi: erc1155TransferAbi,
    functionName: 'safeTransferFrom',
    args: [fromAddress, toAddress, tokenId, amount, '0x' as `0x${string}`], // empty bytes for data
    account,
    chain
  });

  return {
    txHash: hash,
    tokenId: tokenId.toString(),
    amount: amount.toString()
  };
} 