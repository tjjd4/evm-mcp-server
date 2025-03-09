import { 
  formatEther,
  formatUnits,
  type Address,
  type Abi,
  getContract
} from 'viem';
import { getPublicClient } from './clients.js';
import { readContract } from './contracts.js';

// Standard ERC20 ABI (minimal for reading)
const erc20Abi = [
  {
    inputs: [],
    name: 'symbol',
    outputs: [{ type: 'string' }],
    stateMutability: 'view',
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
    inputs: [{ type: 'address', name: 'account' }],
    name: 'balanceOf',
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  }
] as const;

// Standard ERC721 ABI (minimal for reading)
const erc721Abi = [
  {
    inputs: [{ type: 'address', name: 'owner' }],
    name: 'balanceOf',
    outputs: [{ type: 'uint256' }],
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

// Standard ERC1155 ABI (minimal for reading)
const erc1155Abi = [
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
 * Get the ETH balance of an address for a specific network
 */
export async function getETHBalance(
  address: Address, 
  network = 'ethereum'
): Promise<{ wei: bigint; ether: string }> {
  const client = getPublicClient(network);
  const balanceWei = await client.getBalance({ address });
  
  return {
    wei: balanceWei,
    ether: formatEther(balanceWei)
  };
}

/**
 * Get the ERC20 token balance of an address for a specific network
 */
export async function getERC20Balance(
  tokenAddress: Address,
  ownerAddress: Address,
  network = 'ethereum'
): Promise<{
  raw: bigint;
  formatted: string;
  token: {
    symbol: string;
    decimals: number;
  }
}> {
  const publicClient = getPublicClient(network);

  const contract = getContract({
    address: tokenAddress,
    abi: erc20Abi,
    client: publicClient,
  });

  const [balance, symbol, decimals] = await Promise.all([
    contract.read.balanceOf([ownerAddress]),
    contract.read.symbol(),
    contract.read.decimals()
  ]);

  return {
    raw: balance,
    formatted: formatUnits(balance, decimals),
    token: {
      symbol,
      decimals
    }
  };
}

/**
 * Check if an address owns a specific NFT
 */
export async function isNFTOwner(
  tokenAddress: Address,
  ownerAddress: Address,
  tokenId: bigint,
  network = 'ethereum'
): Promise<boolean> {
  const publicClient = getPublicClient(network);

  const contract = getContract({
    address: tokenAddress,
    abi: erc721Abi,
    client: publicClient,
  });

  try {
    const owner = await contract.read.ownerOf([tokenId]);
    return owner.toLowerCase() === ownerAddress.toLowerCase();
  } catch (error) {
    // If the token doesn't exist or there's an error, return false
    return false;
  }
}

/**
 * Get ERC721 NFT balance for an address (number of NFTs owned)
 */
export async function getERC721Balance(
  tokenAddress: Address,
  ownerAddress: Address,
  network = 'ethereum'
): Promise<bigint> {
  const publicClient = getPublicClient(network);

  const contract = getContract({
    address: tokenAddress,
    abi: erc721Abi,
    client: publicClient,
  });

  return contract.read.balanceOf([ownerAddress]);
}

/**
 * Get ERC1155 token balance
 */
export async function getERC1155Balance(
  tokenAddress: Address,
  ownerAddress: Address,
  tokenId: bigint,
  network = 'ethereum'
): Promise<bigint> {
  const publicClient = getPublicClient(network);

  const contract = getContract({
    address: tokenAddress,
    abi: erc1155Abi,
    client: publicClient,
  });

  return contract.read.balanceOf([ownerAddress, tokenId]);
} 