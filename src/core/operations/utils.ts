import { 
  parseEther,
  formatEther,
  createWalletClient,
  http,
  parseAbi,
  type Account,
  type Hash,
  type Chain,
  type WalletClient,
  type Transport,
  type HttpTransport
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { getChain } from '../chains.js';

/**
 * Create a wallet client from a private key and network
 * @param privateKey Private key as a hex string
 * @param network Network name or chain ID
 * @returns Wallet client instance
 */
export async function getWalletClient(
  privateKey: string, 
  network: string
): Promise<WalletClient> {
  const chain = getChain(network);
  
  // Ensure the private key has 0x prefix
  const formattedKey = privateKey.startsWith('0x') 
    ? privateKey as `0x${string}` 
    : `0x${privateKey}` as `0x${string}`;
    
  const account = privateKeyToAccount(formattedKey);
  
  return createWalletClient({
    account,
    chain,
    transport: http()
  });
}

/**
 * Utility functions for formatting and parsing values
 */
export const utils = {
  // Convert ether to wei
  parseEther,
  
  // Convert wei to ether
  formatEther,
  
  // Format a bigint to a string
  formatBigInt: (value: bigint): string => value.toString(),
  
  // Format an object to JSON with bigint handling
  formatJson: (obj: unknown): string => JSON.stringify(obj, (_, value) => 
    typeof value === 'bigint' ? value.toString() : value, 2),
    
  // Format a number with commas
  formatNumber: (value: number | string): string => {
    return Number(value).toLocaleString();
  },
  
  // Convert a hex string to a number
  hexToNumber: (hex: string): number => {
    return parseInt(hex, 16);
  },
  
  // Convert a number to a hex string
  numberToHex: (num: number): string => {
    return '0x' + num.toString(16);
  }
}; 