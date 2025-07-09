import { 
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
export async function writeContract(privateKey: Hex, params: Record<string, any>, network = 'ethereum'): Promise<Hash> {
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
