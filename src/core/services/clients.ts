import { 
  createPublicClient, 
  createWalletClient, 
  http, 
  type PublicClient,
  type WalletClient,
  type Hex,
  type Address
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { getChain, getRpcUrl, getTenderlyRpcUrl } from '../chains.js';
import { mainnet } from 'viem/chains';

// Cache for clients to avoid recreating them for each request
const clientCache = new Map<string, PublicClient>();

/**
 * Get a public client for a specific network
 */
export function getPublicClient(network = 'ethereum'): PublicClient {
  const cacheKey = String(network);
  
  // Return cached client if available
  if (clientCache.has(cacheKey)) {
    return clientCache.get(cacheKey)!;
  }
  
  // Create a new client
  const chain = getChain(network);
  const rpcUrl = getRpcUrl(network);
  
  const client = createPublicClient({
    chain,
    transport: http(rpcUrl)
  });
  
  // Cache the client
  clientCache.set(cacheKey, client);
  
  return client;
}

/**
 * Create a wallet client for a specific network and private key
 */
export function getWalletClient(privateKey: Hex, network = 'ethereum'): WalletClient {
  const chain = getChain(network);
  const rpcUrl = getRpcUrl(network);
  const account = privateKeyToAccount(privateKey);
  
  return createWalletClient({
    account,
    chain,
    transport: http(rpcUrl)
  });
}

/**
 * Get an Ethereum address from a private key
 * @param privateKey The private key in hex format (with or without 0x prefix)
 * @returns The Ethereum address derived from the private key
 */
export function getAddressFromPrivateKey(privateKey: Hex): Address {
  const account = privateKeyToAccount(privateKey);
  return account.address;
} 

export function getTenderlyClient(network = 'ethereum'): PublicClient {
  if (!process.env.TENDERLY_NODE_RPC_KEY) {
      throw new Error('TENDERLY_NODE_RPC_KEY is not set in environment variables');
  }

  const chain = getChain(network);
  const tenderlyRpcUrl = getTenderlyRpcUrl(network);
  const client = createPublicClient({
    chain: chain || mainnet,
    transport: http(tenderlyRpcUrl + `/${process.env.TENDERLY_NODE_RPC_KEY}`),
  });

  return client;
}