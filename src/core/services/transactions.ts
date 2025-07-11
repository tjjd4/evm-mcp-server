import { 
  type Address, 
  type Hash,
  type Abi,
  type TransactionReceipt,
  type EstimateGasParameters,
  type Hex,
  decodeFunctionData,
} from 'viem';

import { getPublicClient, getTenderlyClient } from './clients.js';
import { resolveAddress } from './ens.js';
import { getContractAbi } from './contracts.js';
import { getAlchemyChainName } from '../chains.js';

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
export async function getTransactionHistory(addressOrEns: string, network = 'ethereum'): Promise<any> {
  const alchemyChainName = getAlchemyChainName(network);
  if (!alchemyChainName) {
    throw new Error(`Unsupported network: ${network}`);
  }

  const alchemyDataUrl = `https://api.g.alchemy.com/data/v1/${process.env.ALCHEMY_API_KEY}`;
  const address = await resolveAddress(addressOrEns, network);
  const methodUrl = `transactions/history/by-address`;

  const response = await fetch(`${alchemyDataUrl}/${methodUrl}`, {
    method: 'POST',
    body: JSON.stringify({
      addresses: [{ address, networks: [alchemyChainName] }]
    })
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return response.json()
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
