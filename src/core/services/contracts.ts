import { 
  decodeFunctionData,
  type Address,
  type Hash, 
  type Hex,
  type ReadContractParameters,
  type GetLogsParameters,
  type Abi,
  type Log
} from 'viem';
import { getPublicClient, getWalletClient } from './clients.js';
import { resolveAddress } from './ens.js';
import { getTransaction } from './transactions.js';

/**
 * Read from a contract for a specific network
 */
export async function readContract(params: ReadContractParameters, network = 'ethereum') {
  const client = getPublicClient(network);
  return await client.readContract(params);
}

/**
 * Write to a contract for a specific network
 */
export async function writeContract(
  privateKey: Hex, 
  params: Record<string, any>, 
  network = 'ethereum'
): Promise<Hash> {
  const client = getWalletClient(privateKey, network);
  return await client.writeContract(params as any);
}

/**
 * Get logs for a specific network
 */
export async function getLogs(params: GetLogsParameters, network = 'ethereum'): Promise<Log[]> {
  const client = getPublicClient(network);
  return await client.getLogs(params);
}

/**
 * Check if an address is a contract
 * @param addressOrEns Address or ENS name to check
 * @param network Network name or chain ID
 * @returns True if the address is a contract, false if it's an EOA
 */
export async function isContract(addressOrEns: string, network = 'ethereum'): Promise<boolean> {
  // Resolve ENS name to address if needed
  const address = await resolveAddress(addressOrEns, network);
  
  const client = getPublicClient(network);
  const code = await client.getBytecode({ address });
  return code !== undefined && code !== '0x';
} 


/**
 * Get the ABI of a contract for a specific network
 */
export async function getContractAbi(addressOrEns: string, network = 'ethereum'): Promise<Abi | undefined> {
  // Resolve ENS name to address if needed
  const address = await resolveAddress(addressOrEns, network);
  
  // Use etherscan to get the contract ABI
  const etherscanUrl = `https://api.etherscan.io/v2/api?chainid=1&module=contract&action=getabi&address=${address}&apikey=${process.env.ETHERSCAN_API_KEY}`;

  const response = await fetch(etherscanUrl);
  const data = await response.json();
  
  if (data.status === '1') {
    return JSON.parse(data.result);
  } else {
    return undefined;
  }
}

/**
 * 
 * @param addressOrEns Address or ENS name of the contract
 * @param network Network name or chain ID
 * @returns The contract source code or undefined if not found
 */
export async function getContractSourceCode(addressOrEns: string, network = 'ethereum'): Promise<Record<string, string> | string | undefined> {
  // Resolve ENS name to address if needed
  const address = await resolveAddress(addressOrEns, network);
  
  const etherscanUrl = `https://api.etherscan.io/v2/api?chainid=1&module=contract&action=getsourcecode&address=${address}&apikey=${process.env.ETHERSCAN_API_KEY}`;
  const response = await fetch(etherscanUrl);
  const data = await response.json();

  if (data.status === '1') {
    
    let sourceCodeString = data.result[0].SourceCode;
    
    if (sourceCodeString.startsWith('{{') && sourceCodeString.endsWith('}}')) {
      sourceCodeString = sourceCodeString.slice(1, -1);

      try {
        const sourceCode = JSON.parse(sourceCodeString);
        if (sourceCode.sources && typeof sourceCode.sources === 'object') {
          const sourceCodes: Record<string, string> = {};
          
          // Iterate through each source file
          for (const [filePath, sourceInfo] of Object.entries(sourceCode.sources as Record<string, { content: string }>)) {
            // Extract just the filename without path
            const fileName = filePath.split('/').pop() || filePath;
            // Add to result with filename as key and content as value
            sourceCodes[fileName] = sourceInfo.content;
          }
          return sourceCodes || sourceCode;
        }
      } catch (e) {
        console.error('Failed to parse source code as JSON:', e);
      }
    } else {
      return sourceCodeString;
    }
  } else {
    return undefined;
  }
}


/** * Get the function name and arguments from a transaction input data
 * @param hash Transaction hash
 * @param network Network name or chain ID (default: 'ethereum')
 * @returns An object containing the function name and arguments, or undefined if not found
 */
export async function getFunctionNameAndArgsFromTx(hash: Hash, network = 'ethereum'): Promise<{ functionName: string; args: readonly unknown[] | undefined } | undefined> {
  const tx = await getTransaction(hash, network);
  if (!tx) {
    throw new Error(`Failed to get transaction input: ${hash}`);
  }
  const abi = await getContractAbi(tx.to as string, network);
  if (!abi) {
    console.error(`Could not retrieve ABI for contract: ${tx.to}`);
  }

  let functionName: string | undefined = undefined;
  let args: readonly unknown[] | undefined = undefined;

  try {
    if (abi != undefined && tx.input != undefined) {
      const result = decodeFunctionData({
        abi: abi as Abi,
        data: tx.input as Hex,
      });
      functionName = result.functionName;
      args = result.args;
    } 
  } catch (error) {
    console.error('Failed to decode function signature:', error);
  }

  if (!functionName) {
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
          params: [tx.input as Hex]
        })
      });
    if (!response.ok) {
      throw new Error(`Tenderly API request failed with status ${response.status}`);
    }

    const data = await response.json();
    
    if (data.error) {
      throw new Error(`Tenderly API error: ${data.error.message || 'Unknown error'}`);
    }

    return { functionName: data.result.name, args: data.result.decodedArguments };

    } catch (error) {
      console.error('Failed to get transaction trace:', error);
      return undefined;
    }
  } else {
    return { functionName, args };
  }
}
