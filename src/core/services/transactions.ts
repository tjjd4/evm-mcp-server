import { 
  type Address, 
  type Hash,
  type Abi,
  type TransactionReceipt,
  type EstimateGasParameters,
  Hex,
  decodeFunctionData,
} from 'viem';
import {
  Network,
  Alchemy,
  AssetTransfersCategory,
  SortingOrder,
  type AssetTransfersWithMetadataResponse,
  type AssetTransfersWithMetadataResult
} from 'alchemy-sdk';
import { getPublicClient, getTenderlyClient } from './clients.js';
import { resolveAddress } from './ens.js';
import { getContractAbi } from './contracts.js';

/**
 * Get a transaction by hash for a specific network
 * @param hash - The transaction hash to look up
 * @param network - The network to use (default is 'ethereum')
 * @returns The transaction details
 */
export async function getTransaction(hash: Hash, network = 'ethereum') {
  const client = getPublicClient(network);
  return await client.getTransaction({ hash });
}

/**
 * Get a transaction receipt by hash for a specific network
 * Automatically tries to decode logs by fetching ABI from each log's contract address
 * @param hash - The transaction hash to look up
 * @param network - The network to use (default is 'ethereum')
 * @returns The transaction receipt with decoded logs
 */
export async function getTransactionReceipt(hash: Hash, network = 'ethereum'): Promise<TransactionReceipt> {
  const client = getPublicClient(network);
  const receipt = await client.getTransactionReceipt({ hash });
  if (!receipt) {
    throw new Error(`Transaction receipt not found for hash: ${hash}`);
  }
  const trace = await getTransactionTrace(hash, network);
  return { ...receipt, logs: trace.logs || receipt.logs };
}

/**
 * Get the transaction count for an address for a specific network
 * @param address - The address to get the transaction count for
 * @param network - The network to use (default is 'ethereum')
 * @returns The number of transactions sent from the address
 */
export async function getTransactionCount(address: Address, network = 'ethereum'): Promise<number> {
  const client = getPublicClient(network);
  const count = await client.getTransactionCount({ address });
  return Number(count);
}

/**
 * Estimate gas for a transaction for a specific network
 * @param params - The parameters for the transaction to estimate gas for (EstimateGasParameters from viem)
 * @param network - The network to use (default is 'ethereum')
 * @returns The estimated gas required for the transaction
 */
export async function estimateGas(params: EstimateGasParameters, network = 'ethereum'): Promise<bigint> {
  const client = getPublicClient(network);
  return await client.estimateGas(params);
}

/**
 * Get the chain ID for a specific network
 * @param network - The network to get the chain ID for (default is 'ethereum')
 * @returns The chain ID as a number
 */
export async function getChainId(network = 'ethereum'): Promise<number> {
  const client = getPublicClient(network);
  const chainId = await client.getChainId();
  return Number(chainId);
} 

/**
 * Get all transactions history for an address for a specific network
 * @param addressOrEns - The address or ENS name to get transactions for
 * @param network - The network to use (default is 'ethereum')
 * @returns An array of transaction objects with metadata
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
  const transactions: AssetTransfersWithMetadataResult[] = [];

  if (from_data.transfers.length > 0) {
    transactions.push(...from_data.transfers);
  }

  if (to_data.transfers.length > 0) {
    transactions.push(...to_data.transfers);
  }

  const flattened = transactions.map(({ rawContract, metadata, ...rest }) => ({
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

/**
 * Get the transaction trace for a specific transaction hash using Tenderly
 * Requires TENDERLY_NODE_RPC_KEY environment variable to be set
 * @param hash - The transaction hash to trace
 * @param network - The network to use (default is 'ethereum')
 * @returns The transaction trace object
 */
export async function getTransactionTrace(hash: Hash, network = 'ethereum'): Promise<any> {
  const client = getTenderlyClient(network);

  if (!/^0x([A-Fa-f0-9]{64})$/.test(hash)) {
      throw new Error('Invalid transaction hash format');
  }
  
  try {
    const response = await client.request<{
      method: 'tenderly_traceTransaction',
      Parameters: [Hash],
      ReturnType: any
    }>({
      method: "tenderly_traceTransaction",
      params: [
        // transaction hash
        hash,
      ],
    });

    return response;

  } catch (error) {
    console.error('Error fetching transaction trace:', error);
    throw new Error(`Failed to fetch transaction trace: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get the function name from a function selector using Tenderly
 * Requires TENDERLY_NODE_RPC_KEY environment variable to be set
 * @param functionSelector - The function selector to decode (e.g., '0xa9059cbb' for ERC20 transfer)
 * @param network - The network to use (default is 'ethereum')
 * @returns The decoded function name or undefined if not found
 * @throws Error if the function selector is invalid or if the Tenderly API request fails
 */
export async function decodeInput(callData: string, network = 'ethereum'): Promise<{ functionName: string; args: readonly unknown[] | undefined}> {

  if (!/^0x([A-Fa-f0-9]{8,})$/.test(callData)) {
    throw new Error('Invalid call data format');
  }

  type TDecodeInputParams = [callData: string];
  type TDecodeInputReturnType = {
    name: string;
    decodedArguments: readonly unknown[] | undefined;
  };
  const client = getTenderlyClient(network);

  try {
    const response = await client.request<{
      method: 'tenderly_decodeInput',
      Parameters: TDecodeInputParams,
      ReturnType: TDecodeInputReturnType
    }>({
      method: "tenderly_decodeInput",
      params: [
        // transaction hash
        callData,
      ],
    });

    return {
      functionName: response.name,
      args: response.decodedArguments
    };

  } catch (error) {
    console.error('Error fetching decode input:', error);
    throw new Error(`Failed to decode input: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

 /**
 * Get the function name and arguments from a transaction input data
 * @param hash Transaction hash
 * @param network Network name or chain ID (default: 'ethereum')
 * @returns An object containing the function name and arguments, or undefined if not found
 */
export async function getFunctionNameAndArgsFromTx(hash: Hash, network = 'ethereum'): Promise<{ functionName: string; args: readonly unknown[] | undefined }> {
  const tx = await getTransaction(hash, network);
  if (!tx) {
    throw new Error(`Failed to get transaction input: ${hash}`);
  }
  const abi = await getContractAbi(tx.to as string, network);
  if (!abi) {
    console.error(`Could not retrieve ABI for contract: ${tx.to}`);
  }

  try {
    if (abi != undefined && tx.input != undefined) {
      const result = decodeFunctionData({
        abi: abi as Abi,
        data: tx.input as Hex,
      });
      if (result.functionName !== undefined) {
        return { functionName: result.functionName, args: result.args };
      }
    }
    const decoded = await decodeInput(tx.input as Hex, network);
    return decoded;
  } catch (error) {
    console.error('Failed to decode function signature:', error);
    throw new Error(`Failed to decode function signature: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}


/**
 * Get the transaction history between a user and a contract
 * @param addressOrEns - The user's address or ENS name
 * @param contractAddressOrEns - The contract's address or ENS name
 * @param network - The network to use (default is 'ethereum')
 * @returns An array of transaction objects with metadata
 */
export async function getTwoAddressTransactionHistory(addressOrEns1: string, addressOrEns2: string, network = 'ethereum'): Promise<any[]> {
  // Resolve ENS name to address if needed
  const address1 = await resolveAddress(addressOrEns1, network);
  const address2 = await resolveAddress(addressOrEns2, network);

  const config = {
    apiKey: process.env.ALCHEMY_API_KEY,
    network: Network.ETH_MAINNET,
  };
  const alchemy = new Alchemy(config);

  const from_response: AssetTransfersWithMetadataResponse = await alchemy.core.getAssetTransfers({
    fromBlock: "0x0",
    fromAddress: address1,
    toAddress: address2,
    excludeZeroValue: false,
    category: [AssetTransfersCategory.EXTERNAL, AssetTransfersCategory.INTERNAL],
    order: SortingOrder.DESCENDING,
    withMetadata: true
  });

  const to_response: AssetTransfersWithMetadataResponse = await alchemy.core.getAssetTransfers({
    fromBlock: "0x0",
    fromAddress: address2,
    toAddress: address1,
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
