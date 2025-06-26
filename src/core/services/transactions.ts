import { 
  type Address, 
  type Hash, 
  type TransactionReceipt,
  type EstimateGasParameters,
  type Log,
  decodeEventLog,
  parseEventLogs
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
import { getContractAbi, isContract } from './contracts.js';

/**
 * Get a transaction by hash for a specific network
 */
export async function getTransaction(hash: Hash, network = 'ethereum') {
  const client = getPublicClient(network);
  return await client.getTransaction({ hash });
}

/**
 * Get a transaction receipt by hash for a specific network
 * Automatically tries to decode logs by fetching ABI from each log's contract address
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
export async function getTransactionHistory(addressOrEns: string, network = 'ethereum'): Promise<any[]> {
  const address = await resolveAddress(addressOrEns, network);

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

  const flattened = transfers.map(({ rawContract, metadata, ...rest }) => ({
    ...rest,
    contractAddress: rawContract?.address || null,
    blockTimestamp: metadata?.blockTimestamp || null,
  }));

  const sorted = flattened.sort((a, b) => {
    const aTime = a.blockTimestamp ? new Date(a.blockTimestamp).getTime() : 0;
    const bTime = b.blockTimestamp ? new Date(b.blockTimestamp).getTime() : 0;
    return bTime - aTime;
  });

  return sorted;
}

export async function getTransactionTrace(hash: Hash, network = 'ethereum'): Promise<any> {
  if (!process.env.TENDERLY_NODE_RPC_KEY) {
      throw new Error('TENDERLY_NODE_RPC_KEY is not set in environment variables');
  }

  if (!/^0x([A-Fa-f0-9]{64})$/.test(hash)) {
      throw new Error('Invalid transaction hash format');
  }

  const url = `https://mainnet.gateway.tenderly.co/${process.env.TENDERLY_NODE_RPC_KEY}`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 0,
        method: 'tenderly_traceTransaction',
        params: [hash]
      })
    });

    if (!response.ok) {
      throw new Error(`Tenderly API request failed with status ${response.status}`);
    }

    const data = await response.json();
    
    if (data.error) {
      throw new Error(`Tenderly API error: ${data.error.message || 'Unknown error'}`);
    }

    return data.result;
  } catch (error) {
    console.error('Error fetching transaction trace:', error);
    throw new Error(`Failed to fetch transaction trace: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function getFunctionNameFromFunctionSelector(functionSelector: string, network = 'ethereum'): Promise<string | undefined> {
  if (!process.env.TENDERLY_NODE_RPC_KEY) {
    throw new Error('TENDERLY_NODE_RPC_KEY is not set in environment variables');
  }

  if (!/^0x([A-Fa-f0-9]{8})$/.test(functionSelector)) {
    throw new Error('Invalid function selector format');
  }

  try {
    const url = `https://mainnet.gateway.tenderly.co/${process.env.TENDERLY_NODE_RPC_KEY}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 0,
        method: 'tenderly_decodeInput',
        params: [functionSelector]
      })
    });
    if (!response.ok) {
      throw new Error(`Tenderly API request failed with status ${response.status}`);
    }
    const data = await response.json();
    
    if (data.error) {
      throw new Error(`Tenderly API error: ${data.error.message || 'Unknown error'}`);
    }
    return data.result.name;
  } catch (error) {
    console.error('Error fetching function name:', error);
    return undefined;
  }
}

export async function getUserAndContractTransactionHistory(
  addressOrEns: string,
  contractAddressOrEns: string,
  network = 'ethereum',
): Promise<any[]> {
  // Resolve ENS name to address if needed
  const userAddress = await resolveAddress(addressOrEns, network);
  const contractAddress = await resolveAddress(contractAddressOrEns, network);

  const config = {
    apiKey: process.env.ALCHEMY_API_KEY,
    network: Network.ETH_MAINNET,
  };
  const alchemy = new Alchemy(config);

  const from_response: AssetTransfersWithMetadataResponse = await alchemy.core.getAssetTransfers({
    fromBlock: "0x0",
    fromAddress: userAddress,
    toAddress: contractAddress,
    excludeZeroValue: false,
    category: [AssetTransfersCategory.EXTERNAL, AssetTransfersCategory.INTERNAL],
    order: SortingOrder.DESCENDING,
    withMetadata: true
  });

  const to_response: AssetTransfersWithMetadataResponse = await alchemy.core.getAssetTransfers({
    fromBlock: "0x0",
    fromAddress: contractAddress,
    toAddress: userAddress,
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

  const flattened = transfers.map(({ rawContract, metadata, ...rest }) => ({
    ...rest,
    contractAddress: rawContract?.address || null,
    blockTimestamp: metadata?.blockTimestamp || null,
  }));

  const sorted = flattened.sort((a, b) => {
    const aTime = a.blockTimestamp ? new Date(a.blockTimestamp).getTime() : 0;
    const bTime = b.blockTimestamp ? new Date(b.blockTimestamp).getTime() : 0;
    return bTime - aTime;
  });

  return sorted;
}
