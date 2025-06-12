import { 
  type Address, 
  type Hash, 
  type TransactionReceipt,
  type EstimateGasParameters
} from 'viem';
import {
  Network,
  Alchemy,
  AssetTransfersCategory,
  SortingOrder,
  type AssetTransfersWithMetadataResponse,
  type AssetTransfersWithMetadataResult
} from 'alchemy-sdk';
import { getPublicClient } from './clients.js';
import { resolveAddress } from './ens.js';

/**
 * Get a transaction by hash for a specific network
 */
export async function getTransaction(hash: Hash, network = 'ethereum') {
  const client = getPublicClient(network);
  return await client.getTransaction({ hash });
}

/**
 * Get a transaction receipt by hash for a specific network
 */
export async function getTransactionReceipt(hash: Hash, network = 'ethereum'): Promise<TransactionReceipt> {
  const client = getPublicClient(network);
  return await client.getTransactionReceipt({ hash });
}

/**
 * Get the transaction count for an address for a specific network
 */
export async function getTransactionCount(address: Address, network = 'ethereum'): Promise<number> {
  const client = getPublicClient(network);
  const count = await client.getTransactionCount({ address });
  return Number(count);
}

/**
 * Estimate gas for a transaction for a specific network
 */
export async function estimateGas(params: EstimateGasParameters, network = 'ethereum'): Promise<bigint> {
  const client = getPublicClient(network);
  return await client.estimateGas(params);
}

/**
 * Get the chain ID for a specific network
 */
export async function getChainId(network = 'ethereum'): Promise<number> {
  const client = getPublicClient(network);
  const chainId = await client.getChainId();
  return Number(chainId);
} 

/**
 * Get all transactions history for an address for a specific network
 */
export async function getTransactionsHistory(addressOrEns: string, network = 'ethereum'): Promise<any[]> {
  const address = await resolveAddress(addressOrEns, network);
  
    const client = getPublicClient(network);
  
    const config = {
      apiKey: process.env.ALCHEMY_API_KEY,
      network: Network.ETH_MAINNET,
    };
    const alchemy = new Alchemy(config);
  
    const from_response: AssetTransfersWithMetadataResponse = await alchemy.core.getAssetTransfers({
      fromBlock: "0x0",
      fromAddress: address,
      excludeZeroValue: false,
      category: [AssetTransfersCategory.EXTERNAL, AssetTransfersCategory.INTERNAL],
      order: SortingOrder.DESCENDING,
      withMetadata: true
    });
  
    const to_response: AssetTransfersWithMetadataResponse = await alchemy.core.getAssetTransfers({
      fromBlock: "0x0",
      toAddress: address,
      excludeZeroValue: false,
      category: [AssetTransfersCategory.EXTERNAL, AssetTransfersCategory.INTERNAL],
      order: SortingOrder.DESCENDING,
      withMetadata: true
    });
  
    const from_data = await from_response;
    const to_data = await to_response;
    const transfers: AssetTransfersWithMetadataResult[] = [];
  
    if (from_data.transfers.length > 0) {
      transfers.push(...from_data.transfers);
    }
  
    if (to_data.transfers.length > 0) {
      transfers.push(...to_data.transfers);
    }
  
    return transfers;
}