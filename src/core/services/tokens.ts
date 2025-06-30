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

export async function getERC20TokenPrice(
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
