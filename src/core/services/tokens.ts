import { 
  type Address, 
  type Hex,
  type Hash,
  formatUnits,
  getContract
} from 'viem';
import { getPublicClient } from './clients.js';

// Standard ERC20 ABI (minimal for reading)
const erc20Abi = [
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
    inputs: [],
    name: 'decimals',
    outputs: [{ type: 'uint8' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'totalSupply',
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  }
] as const;

// Standard ERC721 ABI (minimal for reading)
const erc721Abi = [
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
    name: 'tokenURI',
    outputs: [{ type: 'string' }],
    stateMutability: 'view',
    type: 'function'
  }
] as const;

// Standard ERC1155 ABI (minimal for reading)
const erc1155Abi = [
  {
    inputs: [{ type: 'uint256', name: 'id' }],
    name: 'uri',
    outputs: [{ type: 'string' }],
    stateMutability: 'view',
    type: 'function'
  }
] as const;

/**
 * Get ERC20 token information
 * @param tokenAddress - The address of the ERC20 token contract
 * @param network - The network to use (default is 'ethereum')
 * @returns An object containing the token's name, symbol, decimals, total supply, and formatted total supply
 */
export async function getERC20TokenInfo(
  tokenAddress: Address,
  network: string = 'ethereum'
): Promise<{
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: bigint;
  formattedTotalSupply: string;
}> {
  const publicClient = getPublicClient(network);

  const contract = getContract({
    address: tokenAddress,
    abi: erc20Abi,
    client: publicClient,
  });

  const [name, symbol, decimals, totalSupply] = await Promise.all([
    contract.read.name(),
    contract.read.symbol(),
    contract.read.decimals(),
    contract.read.totalSupply()
  ]);

  return {
    name,
    symbol,
    decimals,
    totalSupply,
    formattedTotalSupply: formatUnits(totalSupply, decimals)
  };
}

/**
 * Get ERC721 token metadata
 * @param tokenAddress - The address of the ERC721 token contract
 * @param tokenId - The ID of the specific token to retrieve metadata for
 * @param network - The network to use (default is 'ethereum')
 * @returns An object containing the token's name, symbol, and token URI
 */
export async function getERC721TokenMetadata(
  tokenAddress: Address,
  tokenId: bigint,
  network: string = 'ethereum'
): Promise<{
  name: string;
  symbol: string;
  tokenURI: string;
}> {
  const publicClient = getPublicClient(network);

  const contract = getContract({
    address: tokenAddress,
    abi: erc721Abi,
    client: publicClient,
  });

  const [name, symbol, tokenURI] = await Promise.all([
    contract.read.name(),
    contract.read.symbol(),
    contract.read.tokenURI([tokenId])
  ]);

  return {
    name,
    symbol,
    tokenURI
  };
}

/**
 * Get ERC1155 token URI
 * @param tokenAddress - The address of the ERC1155 token contract
 * @param tokenId - The ID of the specific token to retrieve URI for
 * @param network - The network to use (default is 'ethereum')
 * @returns The URI for the specified token ID
 */
export async function getERC1155TokenURI(
  tokenAddress: Address,
  tokenId: bigint,
  network: string = 'ethereum'
): Promise<string> {
  const publicClient = getPublicClient(network);

  const contract = getContract({
    address: tokenAddress,
    abi: erc1155Abi,
    client: publicClient,
  });

  return contract.read.uri([tokenId]);
}

/**
 * Get the current price of an ERC20 token in USD using Coingecko API
 * Requires COINGECKO_API_KEY environment variable to be set
 * @param tokenSymbol - The symbol of the ERC20 token (e.g., 'eth', 'usdc')
 * @param network - The network to use (default is 'ethereum')
 * @returns The current price of the token in USD, or undefined if not found
 */
export async function getERC20TokenCurrentPrice(
  tokenSymbol: string,
  network: string = 'ethereum'
): Promise<number | undefined> {
  if (!process.env.COINGECKO_API_KEY) {
    throw new Error('COINGECKO_API_KEY is not set in environment variables');
  }

  if (tokenSymbol == '') {
    throw new Error('Token symbol is required to fetch price');
  }

  const url = `https://api.coingecko.com/api/v3/simple/price?vs_currencies=usd&symbols=${tokenSymbol.toLowerCase()}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Coingecko API request failed with status ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching token price:', error);
    return undefined;
  }
}

/**
 * Get the symbol of an ERC20 token from its address
 * Uses the standard ERC20 ABI to read the symbol
 * @param tokenAddress - The address of the ERC20 token contract
 * @param network - The network to use (default is 'ethereum')
 * @returns The symbol of the token, or undefined if not found
 */
export async function getERC20TokenSymbolFromAddress(
  tokenAddress: Address,
  network: string = 'ethereum'
): Promise<string | undefined> {
  const publicClient = getPublicClient(network);

  const contract = getContract({
    address: tokenAddress,
    abi: erc20Abi,
    client: publicClient,
  });

  return contract.read.symbol();
}
