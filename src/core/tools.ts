import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getSupportedNetworks, getRpcUrl } from "./chains.js";
import * as services from "./services/index.js";
import { type Address, type Hex, type Hash } from 'viem';
import { normalize } from 'viem/ens';

/**
 * Register all EVM-related tools with the MCP server
 * 
 * All tools that accept Ethereum addresses also support ENS names (e.g., 'vitalik.eth').
 * ENS names are automatically resolved to addresses using the Ethereum Name Service.
 * 
 * @param server The MCP server instance
 */
export function registerEVMTools(server: McpServer) {
  // NETWORK INFORMATION TOOLS
  
  // Get chain information
  server.tool(
    "get_chain_info",
    "Get information about an EVM network",
    {
      network: z.string().optional().describe("Network name (e.g., 'ethereum', 'optimism', 'arbitrum', 'base', etc.) or chain ID. Supports all EVM-compatible networks. Defaults to Ethereum mainnet.")
    },
    async ({ network = "ethereum" }) => {
      try {
        const chainId = await services.getChainId(network);
        const blockNumber = await services.getBlockNumber(network);
        const rpcUrl = getRpcUrl(network);
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              network,
              chainId,
              blockNumber: blockNumber.toString(),
              rpcUrl
            }, null, 2)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error fetching chain info: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true
        };
      }
    }
  );

  // ENS LOOKUP TOOL
  
  // Resolve ENS name to address
  server.tool(
    "resolve_ens",
    "Resolve an ENS name to an Ethereum address",
    {
      ensName: z.string().describe("ENS name to resolve (e.g., 'vitalik.eth')"),
      network: z.string().optional().describe("Network name (e.g., 'ethereum', 'optimism', 'arbitrum', 'base', etc.) or chain ID. ENS resolution works best on Ethereum mainnet. Defaults to Ethereum mainnet.")
    },
    async ({ ensName, network = "ethereum" }) => {
      try {
        // Validate that the input is an ENS name
        if (!ensName.includes('.')) {
          return {
            content: [{
              type: "text",
              text: `Error: Input "${ensName}" is not a valid ENS name. ENS names must contain a dot (e.g., 'name.eth').`
            }],
            isError: true
          };
        }
        
        // Normalize the ENS name
        const normalizedEns = normalize(ensName);
        
        // Resolve the ENS name to an address
        const address = await services.resolveAddress(ensName, network);
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              ensName: ensName,
              normalizedName: normalizedEns,
              resolvedAddress: address,
              network
            }, null, 2)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error resolving ENS name: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true
        };
      }
    }
  );

  // Get supported networks
  server.tool(
    "get_supported_networks",
    "Get a list of supported EVM networks",
    {},
    async () => {
      try {
        const networks = getSupportedNetworks();
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              supportedNetworks: networks
            }, null, 2)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error fetching supported networks: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true
        };
      }
    }
  );

  // BLOCK TOOLS
  
  // Get block by number
  server.tool(
    "get_block_by_number",
    "Get a block by its block number",
    {
      blockNumber: z.number().describe("The block number to fetch"),
      network: z.string().optional().describe("Network name or chain ID. Defaults to Ethereum mainnet.")
    },
    async ({ blockNumber, network = "ethereum" }) => {
      try {
        const block = await services.getBlockByNumber(blockNumber, network);
        
        return {
          content: [{
            type: "text",
            text: services.helpers.formatJson(block)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error fetching block ${blockNumber}: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true
        };
      }
    }
  );

  // Get latest block
  server.tool(
    "get_latest_block",
    "Get the latest block from the EVM",
    {
      network: z.string().optional().describe("Network name or chain ID. Defaults to Ethereum mainnet.")
    },
    async ({ network = "ethereum" }) => {
      try {
        const block = await services.getLatestBlock(network);
        
        return {
          content: [{
            type: "text",
            text: services.helpers.formatJson(block)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error fetching latest block: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true
        };
      }
    }
  );

  // BALANCE TOOLS
  
  // Get ETH balance
  server.tool(
    "get_balance",
    "Get the native token balance (ETH, MATIC, etc.) for an address", 
    {
      address: z.string().describe("The wallet address or ENS name (e.g., '0x1234...' or 'vitalik.eth') to check the balance for"),
      network: z.string().optional().describe("Network name (e.g., 'ethereum', 'optimism', 'arbitrum', 'base', etc.) or chain ID. Supports all EVM-compatible networks. Defaults to Ethereum mainnet.")
    },
    async ({ address, network = "ethereum" }) => {
      try {
        const balance = await services.getETHBalance(address, network);
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              address,
              network,
              wei: balance.wei.toString(),
              ether: balance.ether
            }, null, 2)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error fetching balance: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true
        };
      }
    }
  );

  // Get ERC20 balance
  server.tool(
    "get_erc20_balance",
    "Get the ERC20 token balance of an Ethereum address",
    {
      address: z.string().describe("The Ethereum address to check"),
      tokenAddress: z.string().describe("The ERC20 token contract address"),
      network: z.string().optional().describe("Network name or chain ID. Defaults to Ethereum mainnet.")
    },
    async ({ address, tokenAddress, network = "ethereum" }) => {
      try {
        const balance = await services.getERC20Balance(
          tokenAddress as Address,
          address as Address,
          network
        );
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              address,
              tokenAddress,
              network,
              balance: {
                raw: balance.raw.toString(),
                formatted: balance.formatted,
                decimals: balance.token.decimals
              }
            }, null, 2)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error fetching ERC20 balance for ${address}: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true
        };
      }
    }
  );

  // Get ERC20 token balance
  server.tool(
    "get_token_balance",
    "Get the balance of an ERC20 token for an address",
    {
      tokenAddress: z.string().describe("The contract address or ENS name of the ERC20 token (e.g., '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' for USDC or 'uniswap.eth')"),
      ownerAddress: z.string().describe("The wallet address or ENS name to check the balance for (e.g., '0x1234...' or 'vitalik.eth')"),
      network: z.string().optional().describe("Network name (e.g., 'ethereum', 'optimism', 'arbitrum', 'base', etc.) or chain ID. Supports all EVM-compatible networks. Defaults to Ethereum mainnet.")
    },
    async ({ tokenAddress, ownerAddress, network = "ethereum" }) => {
      try {
        const balance = await services.getERC20Balance(tokenAddress, ownerAddress, network);
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              tokenAddress,
              owner: ownerAddress,
              network,
              raw: balance.raw.toString(),
              formatted: balance.formatted,
              symbol: balance.token.symbol,
              decimals: balance.token.decimals
            }, null, 2)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error fetching token balance: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true
        };
      }
    }
  );

  // TRANSACTION TOOLS
  
  // Get transaction by hash
  server.tool(
    "get_transaction",
    "Get detailed information about a specific transaction by its hash. Includes sender, recipient, value, data, and more.",
    {
      txHash: z.string().describe("The transaction hash to look up (e.g., '0x1234...')"),
      network: z.string().optional().describe("Network name (e.g., 'ethereum', 'optimism', 'arbitrum', 'base', 'polygon') or chain ID. Defaults to Ethereum mainnet.")
    },
    async ({ txHash, network = "ethereum" }) => {
      try {
        const tx = await services.getTransaction(txHash as Hash, network);
        
        return {
          content: [{
            type: "text",
            text: services.helpers.formatJson(tx)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error fetching transaction ${txHash}: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true
        };
      }
    }
  );

  // Get transaction receipt
  server.tool(
    "get_transaction_receipt",
    "Get a transaction receipt by its hash",
    {
      txHash: z.string().describe("The transaction hash to look up"),
      network: z.string().optional().describe("Network name or chain ID. Defaults to Ethereum mainnet.")
    },
    async ({ txHash, network = "ethereum" }) => {
      try {
        const receipt = await services.getTransactionReceipt(txHash as Hash, network);
        
        return {
          content: [{
            type: "text",
            text: services.helpers.formatJson(receipt)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error fetching transaction receipt ${txHash}: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true
        };
      }
    }
  );

  // Estimate gas
  server.tool(
    "estimate_gas",
    "Estimate the gas cost for a transaction",
    {
      to: z.string().describe("The recipient address"),
      value: z.string().optional().describe("The amount of ETH to send in ether (e.g., '0.1')"),
      data: z.string().optional().describe("The transaction data as a hex string"),
      network: z.string().optional().describe("Network name or chain ID. Defaults to Ethereum mainnet.")
    },
    async ({ to, value, data, network = "ethereum" }) => {
      try {
        const params: any = { to: to as Address };
        
        if (value) {
          params.value = services.helpers.parseEther(value);
        }
        
        if (data) {
          params.data = data as `0x${string}`;
        }
        
        const gas = await services.estimateGas(params, network);
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              network,
              estimatedGas: gas.toString()
            }, null, 2)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error estimating gas: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true
        };
      }
    }
  );

  // TRANSFER TOOLS
  
  // Transfer ETH
  server.tool(
    "transfer_eth",
    "Transfer native tokens (ETH, MATIC, etc.) to an address",
    {
      privateKey: z.string().describe("Private key of the sender account in hex format (with or without 0x prefix). SECURITY: This is used only for transaction signing and is not stored."),
      to: z.string().describe("The recipient address or ENS name (e.g., '0x1234...' or 'vitalik.eth')"),
      amount: z.string().describe("Amount to send in ETH (or the native token of the network), as a string (e.g., '0.1')"),
      network: z.string().optional().describe("Network name (e.g., 'ethereum', 'optimism', 'arbitrum', 'base', etc.) or chain ID. Supports all EVM-compatible networks. Defaults to Ethereum mainnet.")
    },
    async ({ privateKey, to, amount, network = "ethereum" }) => {
      try {
        const txHash = await services.transferETH(privateKey, to, amount, network);
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              txHash,
              to,
              amount,
              network
            }, null, 2)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error transferring ETH: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true
        };
      }
    }
  );

  // Transfer ERC20
  server.tool(
    "transfer_erc20",
    "Transfer ERC20 tokens to another address",
    {
      privateKey: z.string().describe("Private key of the sending account (this is used for signing and is never stored)"),
      tokenAddress: z.string().describe("The address of the ERC20 token contract"),
      toAddress: z.string().describe("The recipient address"),
      amount: z.string().describe("The amount of tokens to send (in token units, e.g., '10' for 10 tokens)"),
      network: z.string().optional().describe("Network name (e.g., 'ethereum', 'optimism', 'arbitrum', 'base', etc.) or chain ID. Supports all EVM-compatible networks. Defaults to Ethereum mainnet.")
    },
    async ({ privateKey, tokenAddress, toAddress, amount, network = "ethereum" }) => {
      try {
        // Get the formattedKey with 0x prefix
        const formattedKey = privateKey.startsWith('0x') 
          ? privateKey as `0x${string}` 
          : `0x${privateKey}` as `0x${string}`;
        
        const result = await services.transferERC20(
          tokenAddress as Address, 
          toAddress as Address, 
          amount,
          formattedKey,
          network
        );
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              txHash: result.txHash,
              network,
              tokenAddress,
              recipient: toAddress,
              amount: result.amount.formatted,
              symbol: result.token.symbol
            }, null, 2)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error transferring ERC20 tokens: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true
        };
      }
    }
  );

  // Approve ERC20 token spending
  server.tool(
    "approve_token_spending",
    "Approve another address (like a DeFi protocol or exchange) to spend your ERC20 tokens. This is often required before interacting with DeFi protocols.",
    {
      privateKey: z.string().describe("Private key of the token owner account in hex format (with or without 0x prefix). SECURITY: This is used only for transaction signing and is not stored."),
      tokenAddress: z.string().describe("The contract address of the ERC20 token to approve for spending (e.g., '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' for USDC on Ethereum)"),
      spenderAddress: z.string().describe("The contract address being approved to spend your tokens (e.g., a DEX or lending protocol)"),
      amount: z.string().describe("The amount of tokens to approve in token units, not wei (e.g., '1000' to approve spending 1000 tokens). Use a very large number for unlimited approval."),
      network: z.string().optional().describe("Network name (e.g., 'ethereum', 'optimism', 'arbitrum', 'base', 'polygon') or chain ID. Defaults to Ethereum mainnet.")
    },
    async ({ privateKey, tokenAddress, spenderAddress, amount, network = "ethereum" }) => {
      try {
        // Get the formattedKey with 0x prefix
        const formattedKey = privateKey.startsWith('0x') 
          ? privateKey as `0x${string}` 
          : `0x${privateKey}` as `0x${string}`;
        
        const result = await services.approveERC20(
          tokenAddress as Address, 
          spenderAddress as Address, 
          amount,
          formattedKey,
          network
        );
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              txHash: result.txHash,
              network,
              tokenAddress,
              spender: spenderAddress,
              amount: result.amount.formatted,
              symbol: result.token.symbol
            }, null, 2)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error approving token spending: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true
        };
      }
    }
  );

  // Transfer NFT (ERC721)
  server.tool(
    "transfer_nft",
    "Transfer an NFT (ERC721 token) from one address to another. Requires the private key of the current owner for signing the transaction.",
    {
      privateKey: z.string().describe("Private key of the NFT owner account in hex format (with or without 0x prefix). SECURITY: This is used only for transaction signing and is not stored."),
      tokenAddress: z.string().describe("The contract address of the NFT collection (e.g., '0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D' for Bored Ape Yacht Club)"),
      tokenId: z.string().describe("The ID of the specific NFT to transfer (e.g., '1234')"),
      toAddress: z.string().describe("The recipient wallet address that will receive the NFT"),
      network: z.string().optional().describe("Network name (e.g., 'ethereum', 'optimism', 'arbitrum', 'base', 'polygon') or chain ID. Most NFTs are on Ethereum mainnet, which is the default.")
    },
    async ({ privateKey, tokenAddress, tokenId, toAddress, network = "ethereum" }) => {
      try {
        // Get the formattedKey with 0x prefix
        const formattedKey = privateKey.startsWith('0x') 
          ? privateKey as `0x${string}` 
          : `0x${privateKey}` as `0x${string}`;
        
        const result = await services.transferERC721(
          tokenAddress as Address, 
          toAddress as Address, 
          BigInt(tokenId),
          formattedKey,
          network
        );
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              txHash: result.txHash,
              network,
              collection: tokenAddress,
              tokenId: result.tokenId,
              recipient: toAddress,
              name: result.token.name,
              symbol: result.token.symbol
            }, null, 2)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error transferring NFT: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true
        };
      }
    }
  );

  // Transfer ERC1155 token
  server.tool(
    "transfer_erc1155",
    "Transfer ERC1155 tokens to another address. ERC1155 is a multi-token standard that can represent both fungible and non-fungible tokens in a single contract.",
    {
      privateKey: z.string().describe("Private key of the token owner account in hex format (with or without 0x prefix). SECURITY: This is used only for transaction signing and is not stored."),
      tokenAddress: z.string().describe("The contract address of the ERC1155 token collection (e.g., '0x76BE3b62873462d2142405439777e971754E8E77')"),
      tokenId: z.string().describe("The ID of the specific token to transfer (e.g., '1234')"),
      amount: z.string().describe("The quantity of tokens to send (e.g., '1' for a single NFT or '10' for 10 fungible tokens)"),
      toAddress: z.string().describe("The recipient wallet address that will receive the tokens"),
      network: z.string().optional().describe("Network name (e.g., 'ethereum', 'optimism', 'arbitrum', 'base', 'polygon') or chain ID. ERC1155 tokens exist across many networks. Defaults to Ethereum mainnet.")
    },
    async ({ privateKey, tokenAddress, tokenId, amount, toAddress, network = "ethereum" }) => {
      try {
        // Get the formattedKey with 0x prefix
        const formattedKey = privateKey.startsWith('0x') 
          ? privateKey as `0x${string}` 
          : `0x${privateKey}` as `0x${string}`;
        
        const result = await services.transferERC1155(
          tokenAddress as Address, 
          toAddress as Address, 
          BigInt(tokenId),
          amount,
          formattedKey,
          network
        );
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              txHash: result.txHash,
              network,
              contract: tokenAddress,
              tokenId: result.tokenId,
              amount: result.amount,
              recipient: toAddress
            }, null, 2)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error transferring ERC1155 tokens: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true
        };
      }
    }
  );

  // Transfer ERC20 tokens
  server.tool(
    "transfer_token",
    "Transfer ERC20 tokens to an address",
    {
      privateKey: z.string().describe("Private key of the sender account in hex format (with or without 0x prefix). SECURITY: This is used only for transaction signing and is not stored."),
      tokenAddress: z.string().describe("The contract address or ENS name of the ERC20 token to transfer (e.g., '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' for USDC or 'uniswap.eth')"),
      toAddress: z.string().describe("The recipient address or ENS name that will receive the tokens (e.g., '0x1234...' or 'vitalik.eth')"),
      amount: z.string().describe("Amount of tokens to send as a string (e.g., '100' for 100 tokens). This will be adjusted for the token's decimals."),
      network: z.string().optional().describe("Network name (e.g., 'ethereum', 'optimism', 'arbitrum', 'base', etc.) or chain ID. Supports all EVM-compatible networks. Defaults to Ethereum mainnet.")
    },
    async ({ privateKey, tokenAddress, toAddress, amount, network = "ethereum" }) => {
      try {
        const result = await services.transferERC20(
          tokenAddress,
          toAddress,
          amount,
          privateKey,
          network
        );
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              txHash: result.txHash,
              tokenAddress,
              toAddress,
              amount: result.amount.formatted,
              symbol: result.token.symbol,
              network
            }, null, 2)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error transferring tokens: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true
        };
      }
    }
  );

  // CONTRACT TOOLS
  
  // Read contract
  server.tool(
    "read_contract",
    "Read data from a smart contract by calling a view/pure function. This doesn't modify blockchain state and doesn't require gas or signing.",
    {
      contractAddress: z.string().describe("The address of the smart contract to interact with"),
      abi: z.array(z.any()).describe("The ABI (Application Binary Interface) of the smart contract function, as a JSON array"),
      functionName: z.string().describe("The name of the function to call on the contract (e.g., 'balanceOf')"),
      args: z.array(z.any()).optional().describe("The arguments to pass to the function, as an array (e.g., ['0x1234...'])"),
      network: z.string().optional().describe("Network name (e.g., 'ethereum', 'optimism', 'arbitrum', 'base', 'polygon') or chain ID. Defaults to Ethereum mainnet.")
    },
    async ({ contractAddress, abi, functionName, args = [], network = "ethereum" }) => {
      try {
        // Parse ABI if it's a string
        const parsedAbi = typeof abi === 'string' ? JSON.parse(abi) : abi;
        
        const params = {
          address: contractAddress as Address,
          abi: parsedAbi,
          functionName,
          args
        };
        
        const result = await services.readContract(params, network);
        
        return {
          content: [{
            type: "text",
            text: services.helpers.formatJson(result)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error reading contract: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true
        };
      }
    }
  );

  // Write to contract
  server.tool(
    "write_contract",
    "Write data to a smart contract by calling a state-changing function. This modifies blockchain state and requires gas payment and transaction signing.",
    {
      contractAddress: z.string().describe("The address of the smart contract to interact with"),
      abi: z.array(z.any()).describe("The ABI (Application Binary Interface) of the smart contract function, as a JSON array"),
      functionName: z.string().describe("The name of the function to call on the contract (e.g., 'transfer')"),
      args: z.array(z.any()).describe("The arguments to pass to the function, as an array (e.g., ['0x1234...', '1000000000000000000'])"),
      privateKey: z.string().describe("Private key of the sending account in hex format (with or without 0x prefix). SECURITY: This is used only for transaction signing and is not stored."),
      network: z.string().optional().describe("Network name (e.g., 'ethereum', 'optimism', 'arbitrum', 'base', 'polygon') or chain ID. Defaults to Ethereum mainnet.")
    },
    async ({ contractAddress, abi, functionName, args, privateKey, network = "ethereum" }) => {
      try {
        // Parse ABI if it's a string
        const parsedAbi = typeof abi === 'string' ? JSON.parse(abi) : abi;
        
        const contractParams: Record<string, any> = {
          address: contractAddress as Address,
          abi: parsedAbi,
          functionName,
          args
        };
        
        const txHash = await services.writeContract(
          privateKey as Hex, 
          contractParams, 
          network
        );
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              network,
              transactionHash: txHash,
              message: "Contract write transaction sent successfully"
            }, null, 2)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error writing to contract: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true
        };
      }
    }
  );

  // Check if address is a contract
  server.tool(
    "is_contract",
    "Check if an address is a smart contract or an externally owned account (EOA)",
    {
      address: z.string().describe("The wallet or contract address or ENS name to check (e.g., '0x1234...' or 'uniswap.eth')"),
      network: z.string().optional().describe("Network name (e.g., 'ethereum', 'optimism', 'arbitrum', 'base', etc.) or chain ID. Supports all EVM-compatible networks. Defaults to Ethereum mainnet.")
    },
    async ({ address, network = "ethereum" }) => {
      try {
        const isContract = await services.isContract(address, network);
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              address,
              network,
              isContract,
              type: isContract ? "Contract" : "Externally Owned Account (EOA)"
            }, null, 2)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error checking if address is a contract: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true
        };
      }
    }
  );

  // Get ERC20 token information
  server.tool(
    "get_token_info",
    "Get comprehensive information about an ERC20 token including name, symbol, decimals, total supply, and other metadata. Use this to analyze any token on EVM chains.",
    {
      tokenAddress: z.string().describe("The contract address of the ERC20 token (e.g., '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' for USDC on Ethereum)"),
      network: z.string().optional().describe("Network name (e.g., 'ethereum', 'optimism', 'arbitrum', 'base', 'polygon') or chain ID. Defaults to Ethereum mainnet.")
    },
    async ({ tokenAddress, network = "ethereum" }) => {
      try {
        const tokenInfo = await services.getERC20TokenInfo(tokenAddress as Address, network);
        
        return {
          content: [{
            type: "text",
            text: services.helpers.formatJson({
              address: tokenAddress,
              network,
              ...tokenInfo
            })
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error fetching token info: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true
        };
      }
    }
  );

  // Get ERC20 token balance
  server.tool(
    "get_token_balance_erc20",
    "Get ERC20 token balance for an address",
    {
      address: z.string().describe("The address to check balance for"),
      tokenAddress: z.string().describe("The ERC20 token contract address"),
      network: z.string().optional().describe("Network name or chain ID. Defaults to Ethereum mainnet.")
    },
    async ({ address, tokenAddress, network = "ethereum" }) => {
      try {
        const balance = await services.getERC20Balance(
          tokenAddress as Address,
          address as Address,
          network
        );
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              address,
              tokenAddress,
              network,
              balance: {
                raw: balance.raw.toString(),
                formatted: balance.formatted,
                decimals: balance.token.decimals
              }
            }, null, 2)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error fetching ERC20 balance for ${address}: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true
        };
      }
    }
  );

  // Get NFT (ERC721) information
  server.tool(
    "get_nft_info",
    "Get detailed information about a specific NFT (ERC721 token), including collection name, symbol, token URI, and current owner if available.",
    {
      tokenAddress: z.string().describe("The contract address of the NFT collection (e.g., '0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D' for Bored Ape Yacht Club)"),
      tokenId: z.string().describe("The ID of the specific NFT token to query (e.g., '1234')"),
      network: z.string().optional().describe("Network name (e.g., 'ethereum', 'optimism', 'arbitrum', 'base', 'polygon') or chain ID. Most NFTs are on Ethereum mainnet, which is the default.")
    },
    async ({ tokenAddress, tokenId, network = "ethereum" }) => {
      try {
        const nftInfo = await services.getERC721TokenMetadata(
          tokenAddress as Address, 
          BigInt(tokenId), 
          network
        );
        
        // Check ownership separately
        let owner = null;
        try {
          // This may fail if tokenId doesn't exist
          owner = await services.getPublicClient(network).readContract({
            address: tokenAddress as Address,
            abi: [{ 
              inputs: [{ type: 'uint256' }], 
              name: 'ownerOf', 
              outputs: [{ type: 'address' }],
              stateMutability: 'view',
              type: 'function'
            }],
            functionName: 'ownerOf',
            args: [BigInt(tokenId)]
          });
        } catch (e) {
          // Ownership info not available
        }
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              contract: tokenAddress,
              tokenId,
              network,
              ...nftInfo,
              owner: owner || 'Unknown'
            }, null, 2)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error fetching NFT info: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true
        };
      }
    }
  );

  // Check NFT ownership
  server.tool(
    "check_nft_ownership",
    "Check if an address owns a specific NFT",
    {
      tokenAddress: z.string().describe("The contract address or ENS name of the NFT collection (e.g., '0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D' for BAYC or 'boredapeyachtclub.eth')"),
      tokenId: z.string().describe("The ID of the NFT to check (e.g., '1234')"),
      ownerAddress: z.string().describe("The wallet address or ENS name to check ownership against (e.g., '0x1234...' or 'vitalik.eth')"),
      network: z.string().optional().describe("Network name (e.g., 'ethereum', 'optimism', 'arbitrum', 'base', etc.) or chain ID. Supports all EVM-compatible networks. Defaults to Ethereum mainnet.")
    },
    async ({ tokenAddress, tokenId, ownerAddress, network = "ethereum" }) => {
      try {
        const isOwner = await services.isNFTOwner(
          tokenAddress,
          ownerAddress,
          BigInt(tokenId),
          network
        );
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              tokenAddress,
              tokenId,
              ownerAddress,
              network,
              isOwner,
              result: isOwner ? "Address owns this NFT" : "Address does not own this NFT"
            }, null, 2)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error checking NFT ownership: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true
        };
      }
    }
  );

  // Add tool for getting ERC1155 token URI
  server.tool(
    "get_erc1155_token_uri",
    "Get the metadata URI for an ERC1155 token (multi-token standard used for both fungible and non-fungible tokens). The URI typically points to JSON metadata about the token.",
    {
      tokenAddress: z.string().describe("The contract address of the ERC1155 token collection (e.g., '0x76BE3b62873462d2142405439777e971754E8E77')"),
      tokenId: z.string().describe("The ID of the specific token to query metadata for (e.g., '1234')"),
      network: z.string().optional().describe("Network name (e.g., 'ethereum', 'optimism', 'arbitrum', 'base', 'polygon') or chain ID. ERC1155 tokens exist across many networks. Defaults to Ethereum mainnet.")
    },
    async ({ tokenAddress, tokenId, network = "ethereum" }) => {
      try {
        const uri = await services.getERC1155TokenURI(
          tokenAddress as Address, 
          BigInt(tokenId), 
          network
        );
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              contract: tokenAddress,
              tokenId,
              network,
              uri
            }, null, 2)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error fetching ERC1155 token URI: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true
        };
      }
    }
  );

  // Add tool for getting ERC721 NFT balance
  server.tool(
    "get_nft_balance",
    "Get the total number of NFTs owned by an address from a specific collection. This returns the count of NFTs, not individual token IDs.",
    {
      tokenAddress: z.string().describe("The contract address of the NFT collection (e.g., '0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D' for Bored Ape Yacht Club)"),
      ownerAddress: z.string().describe("The wallet address to check the NFT balance for (e.g., '0x1234...')"),
      network: z.string().optional().describe("Network name (e.g., 'ethereum', 'optimism', 'arbitrum', 'base', 'polygon') or chain ID. Most NFTs are on Ethereum mainnet, which is the default.")
    },
    async ({ tokenAddress, ownerAddress, network = "ethereum" }) => {
      try {
        const balance = await services.getERC721Balance(
          tokenAddress as Address, 
          ownerAddress as Address, 
          network
        );
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              collection: tokenAddress,
              owner: ownerAddress,
              network,
              balance: balance.toString()
            }, null, 2)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error fetching NFT balance: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true
        };
      }
    }
  );

  // Add tool for getting ERC1155 token balance
  server.tool(
    "get_erc1155_balance",
    "Get the balance of a specific ERC1155 token ID owned by an address. ERC1155 allows multiple tokens of the same ID, so the balance can be greater than 1.",
    {
      tokenAddress: z.string().describe("The contract address of the ERC1155 token collection (e.g., '0x76BE3b62873462d2142405439777e971754E8E77')"),
      tokenId: z.string().describe("The ID of the specific token to check the balance for (e.g., '1234')"),
      ownerAddress: z.string().describe("The wallet address to check the token balance for (e.g., '0x1234...')"),
      network: z.string().optional().describe("Network name (e.g., 'ethereum', 'optimism', 'arbitrum', 'base', 'polygon') or chain ID. ERC1155 tokens exist across many networks. Defaults to Ethereum mainnet.")
    },
    async ({ tokenAddress, tokenId, ownerAddress, network = "ethereum" }) => {
      try {
        const balance = await services.getERC1155Balance(
          tokenAddress as Address, 
          ownerAddress as Address, 
          BigInt(tokenId),
          network
        );
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              contract: tokenAddress,
              tokenId,
              owner: ownerAddress,
              network,
              balance: balance.toString()
            }, null, 2)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error fetching ERC1155 token balance: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true
        };
      }
    }
  );

  // WALLET TOOLS

  // Get address from private key
  server.tool(
    "get_address_from_private_key",
    "Get the EVM address derived from a private key",
    {
      privateKey: z.string().describe("Private key in hex format (with or without 0x prefix). SECURITY: This is used only for address derivation and is not stored.")
    },
    async ({ privateKey }) => {
      try {
        // Ensure the private key has 0x prefix
        const formattedKey = privateKey.startsWith('0x') ? privateKey as Hex : `0x${privateKey}` as Hex;
        
        const address = services.getAddressFromPrivateKey(formattedKey);
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              address,
              privateKey: "0x" + privateKey.replace(/^0x/, '')
            }, null, 2)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error deriving address from private key: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true
        };
      }
    }
  );

  // =============================================
  // NEW TOOLS
  // =============================================
  

  // Get transfers history
  server.tool(
    "get_transfer_history",
    "Get transfer history for an address including ERC20, ERC721 and ERC1155 tokens",
    {
      address: z.string().describe("The wallet or contract address or ENS name to check (e.g., '0x1234...' or 'uniswap.eth')"),
      network: z.string().optional().describe("Network name (e.g., 'ethereum', 'optimism', 'arbitrum', 'base', etc.) or chain ID. Supports all EVM-compatible networks. Defaults to Ethereum mainnet.")
    },
    async ({ address, network = "ethereum" }) => {
      try {
        const transfers = await services.getTransferHistory(address.trim(), network);

        return {
          content: [{
            type: "text",
            text: services.helpers.formatJson({
              address,
              network,
              amount: transfers.transfers.length,
              transfers: transfers.transfers,
            }),
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error fetching recent transactions for ${address}: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true
        };
      }
    }
  );

  server.tool(
    "get_receive_history",
    "Get receive history for an address including ERC20, ERC721 and ERC1155 tokens",
    {
      address: z.string().describe("The wallet or contract address or ENS name to check (e.g., '0x1234...' or 'uniswap.eth')"),
      network: z.string().optional().describe("Network name (e.g., 'ethereum', 'optimism', 'arbitrum', 'base', etc.) or chain ID. Supports all EVM-compatible networks. Defaults to Ethereum mainnet.")
    },
    async ({ address, network = "ethereum" }) => {
      try {
        const transfers = await services.getReceiveHistory(address.trim(), network);
        return {
          content: [{
            type: "text",
            text: services.helpers.formatJson({
              address,
              network,
              amount: transfers.transfers.length,
              transfers: transfers.transfers,
            }),
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error fetching receive history for ${address}: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true
        };
      }
    }
  );

  // Get transactions history
  server.tool(
    "get_transaction_history",
    "Get transaction history for an address including internal transactions",
    {
      address: z.string().describe("The wallet or contract address or ENS name to check (e.g., '0x1234...' or 'vitalik.eth')"),
      network: z.string().optional().describe("Network name (e.g., 'ethereum', 'optimism', 'arbitrum', 'base', etc.) or chain ID. Supports all EVM-compatible networks. Defaults to Ethereum mainnet.")
    },
    async ({ address, network = "ethereum" }) => {
      try {
        const transactions = await services.getTransactionHistory(address.trim(), network);
        return {
          content: [{
            type: "text",
            text: services.helpers.formatJson({
              address,
              network,
              amount: transactions.length,
              transactions: transactions,
            }),
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error fetching transactions history for ${address}: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true
        };
      }
    }
  );

  // Get contract ABI
  server.tool(
    "get_contract_abi",
    "Get the ABI (Application Binary Interface) of a verified smart contract",
    {
      address: z.string().describe("Contract address or ENS name (e.g., '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984' or 'uniswap.eth')"),
      network: z.string().optional().describe("Network name (e.g., 'ethereum', 'optimism', 'arbitrum', 'base', etc.) or chain ID. Supports all EVM-compatible networks. Defaults to Ethereum mainnet.")
    },
    async ({ address, network }) => {
      try {
        const abi = await services.getContractAbi(address, network);
        
        if (!abi) {
          return {
            content: [{
              type: 'text',
              text: `No verified ABI found for contract at ${address} on Ethereum Mainnet`
            }],
            isError: true
          };
        }
        
        const abiString = JSON.stringify(abi, null, 2);
        
        return {
          content: [{
            type: 'text',
            text: `ABI for ${address} on Ethereum Mainnet:\n${abiString}`
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: 'text',
            text: `Failed to get contract ABI: ${error instanceof Error ? error.message : 'Unknown error'}`
          }],
          isError: true
        };
      }
    }
  );

  // Get contract source code
  server.tool(
    "get_contract_source_code",
    "Get the source code of a verified smart contract",
    {
      address: z.string().describe("Contract address or ENS name (e.g., '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984' or 'uniswap.eth')"),
      network: z.string().optional().describe("Network name (e.g., 'ethereum', 'optimism', 'arbitrum', 'base', etc.) or chain ID. Supports all EVM-compatible networks. Defaults to Ethereum mainnet.")
    },
    async ({ address, network }) => {
      try {
        const code = await services.getContractSourceCode(address, network);
        
        if (!code) {
          return {
            content: [{
              type: 'text',
              text: `No verified code found for contract at ${address} on Ethereum Mainnet`
            }],
            isError: true
          };
        }

        const entries = Object.entries(code);
        
        return {
          content: [{
            type: 'text',
            text: `Code for ${address} on Ethereum Mainnet:\n${JSON.stringify(entries, null, 2)}`
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: 'text',
            text: `Failed to get contract code: ${error instanceof Error ? error.message : 'Unknown error'}`
          }],
          isError: true
        };
      }
    }
  );

  // Get function name and arguments from transaction input
  server.tool(
    "get_function_name_args_from_tx",
    "Get the function name and arguments from the transaction input",
    {
      txHash: z.string().describe("The transaction hash"),
      network: z.string().optional().describe("Network name (e.g., 'ethereum', 'optimism', 'arbitrum', 'base', etc.) or chain ID. Supports all EVM-compatible networks. Defaults to Ethereum mainnet.")
    },
    async ({ txHash, network }) => {
      try {
        const result = await services.getFunctionNameAndArgsFromTx(txHash as Hash, network);
        if (result) {
          return {
            content: [{
              type: "text",
              text: `Function name: ${result.functionName}\nArguments: ${services.helpers.formatJson(result.args)}`
            }]
          };
        } else {
          return {
            content: [{
              type: "text",
              text: `No matching function found for transaction: ${txHash}`
            }],
            isError: true
          };
        }
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error fetching function name and args: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true
        };
      }
    }
  );

  // Get transaction trace
  server.tool(
    "get_transaction_trace",
    "Get the detail transaction trace for a specific transaction",
    {
      txHash: z.string().describe("The transaction hash"),
      network: z.string().optional().describe("Network name (e.g., 'ethereum', 'optimism', 'arbitrum', 'base', etc.) or chain ID.  Supports all EVM-compatible networks. Defaults to Ethereum mainnet.")
    },
    async ({ txHash, network }) => {
      try {
        const trace = await services.getTransactionTrace(txHash as Hash, network);
        return {
          content: [{
            type: "text",
            text: services.helpers.formatJson(trace)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error fetching transaction trace: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true
        };
      }
    }
  );

  // Get function name from function selector
  server.tool(
    "get_function_name_from_call_data",
    "Get the function name from call data (function selector) for a contract interaction",
    {
      callData: z.string().describe("The call data to decode, typically the first 4 bytes of the transaction input data which is function selector, and the rest is arguments. This is in hex format."),
      network: z.string().optional().describe("Network name (e.g., 'ethereum', 'optimism', 'arbitrum', 'base', etc.) or chain ID. Defaults to Ethereum mainnet.")
    },
    async ({ callData, network }) => {
      try {
        const result = await services.decodeInput(callData as string, network);
        return {
          content: [{
            type: "text",
            text: `Function name: ${result.functionName},\nArguments: ${services.helpers.formatJson(result.args!)}`
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error fetching function name: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true
        };
      }
    }
  );

  server.tool(
    "get_erc20_token_current_price",
    "Get the current price of an ERC20 token in USD",
    {
      tokenSymbol: z.string().describe("Token symbol (e.g., 'usdt')")
    },
    async ({ tokenSymbol }) => {
      const network = 'ethereum'; // Hardcoded to Ethereum mainnet
      try {
        const price = await services.getERC20TokenCurrentPrice(tokenSymbol, network);
        if (!price) {
          throw new Error('Failed to fetch token price');
        }
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              tokenSymbol,
              price
            }, null, 2)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error fetching token price for ${tokenSymbol}: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true
        };
      }
    }
  );

  server.tool(
    "get_token_symbol_from_address",
    "Get the symbol of an ERC20 token from its contract address",
    {
      tokenAddress: z.string().describe("Token contract address (e.g., '0x...')")
    },
    async ({ tokenAddress }) => {
      const network = 'ethereum'; // Hardcoded to Ethereum mainnet
      try {
        const symbol = await services.getERC20TokenSymbolFromAddress(tokenAddress as Address, network);
        if (!symbol) {
          throw new Error('Failed to fetch token symbol');
        }
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              tokenAddress,
              symbol
            }, null, 2)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error fetching token symbol for ${tokenAddress}: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true
        };
      }
    }
  );

  // base on the analysis level, provide a recommended tool chain for transaction analysis
  server.tool(
    "analyze_transaction",
    "Smart transaction analysis router that provides tool recommendations based on analysis level. Always call this first for transaction analysis to get guidance on which tools to use.",
    {
      level: z.enum(["basic", "detailed", "deep"]).describe("Analysis level: 'basic' (simple overview), 'detailed' (with trace and function), 'deep' (with source code and ABI)"),
      txHash: z.string().describe("The transaction hash to analyze"),
    },
    async ({ level, txHash }) => {
      const network = 'ethereum';
      try {
        // First, get basic transaction info to determine the analysis path
        const transaction = await services.getTransaction(txHash as Hash, network);
        const isContractTransaction = transaction.to && await services.isContract(transaction.to);
        
        let recommendations = `Transaction Analysis Plan (Level: ${level})\n\n`;
        recommendations += `Transaction Hash: ${txHash}\n`;
        recommendations += `Transaction Type: ${isContractTransaction ? 'Contract Interaction' : 'Simple Transfer'}\n`;
        
        if (transaction.to) {
          recommendations += `Target Address: ${transaction.to}\n`;
        }
        
        recommendations += `\nRecommended Tool Chain:\n`;
        
        // Always start with basic transaction info
        recommendations += `1. get_transaction - Get basic transaction details\n`;
        recommendations += `2. get_transaction_receipt - Get transaction receipt and events\n`;
        
        if (!isContractTransaction) {
          recommendations += `\nThis is a simple ETH transfer. Basic tools above are sufficient.\n`;
        } else {
          // Contract transaction - provide level-specific recommendations
          switch (level) {
            case "basic":
              recommendations += `3. is_contract - Confirm contract interaction\n`;
              recommendations += `\nBasic analysis complete. For more details, use 'detailed' or 'deep' levels.\n`;
              break;
              
            case "detailed":
              recommendations += `3. get_function_name_args_from_tx - Extract function call details\n`;
              recommendations += `4. get_transaction_trace - Get detailed execution trace\n`;
              recommendations += `\nDetailed analysis with function calls and execution trace. This will help understand what function was called and how it executed.\n`;
              break;
              
            case "deep":
              recommendations += `3. get_function_name_args_from_tx - Extract function call details\n`;
              recommendations += `4. get_transaction_trace - Get detailed execution trace\n`;
              recommendations += `5. get_contract_abi - Get contract ABI\n`;
              recommendations += `6. get_contract_source_code - Get contract source code\n`;
              recommendations += `\nDeep analysis with complete contract understanding. Use all tools above for comprehensive transaction analysis including source code review.\n`;
              break;
          }
          
          recommendations += `\nOptional additional tools based on findings:\n`;
          recommendations += `- get_function_name_from_function_selector - If you need to decode function selectors\n`;
          recommendations += `- get_token_info - If ERC20 token transfers are involved\n`;
          recommendations += `- get_nft_info - If NFT transfers are involved\n`;
          recommendations += `- analyze_user_contract_interactions - For user behavior analysis\n`;
        }
        
        return {
          content: [{
            type: "text",
            text: recommendations
          }]
        };
        
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error in transaction analysis planning: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true
        };
      }
    }
  );

  // UTILITY TOOLS
  
  // Format wei to ether
  server.tool(
    "format_wei_to_ether",
    "Convert wei to ether format for better readability",
    {
      wei: z.string().describe("Wei amount as string (e.g., '1000000000000000000' for 1 ETH)")
    },
    async ({ wei }) => {
      try {
        const result = services.helpers.formatEther(BigInt(wei));
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              wei,
              ether: result
            }, null, 2)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error converting wei to ether: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true
        };
      }
    }
  );

  // Format ether to wei
  server.tool(
    "format_ether_to_wei",
    "Convert ether to wei format for blockchain transactions",
    {
      ether: z.string().describe("Ether amount as string (e.g., '1.5' for 1.5 ETH)")
    },
    async ({ ether }) => {
      try {
        const result = services.helpers.parseEther(ether).toString();
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              ether,
              wei: result
            }, null, 2)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error converting ether to wei: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true
        };
      }
    }
  );

  // Format a number with commas
  server.tool(
    "format_number",
    "Format a number with commas for better readability",
    {
      value: z.string().describe("Number value as string (e.g., '1234567.89')")
    },
    async ({ value }) => {
      try {
        if (!value) {
          throw new Error('Value is required');
        }
        const result = services.helpers.formatNumber(value);
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              original: value,
              formatted: result.toString()
            }, null, 2)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error formatting number: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true
        };
      }
    }
  );

  // Convert hex to number
  server.tool(
    "hex_to_number",
    "Convert hexadecimal string to decimal number",
    {
      hex: z.string().describe("Hexadecimal string (with or without 0x prefix, e.g., '0x1a' or '1a')")
    },
    async ({ hex }) => {
      try {
        if (!hex) {
          throw new Error('Hex string is required');
        }
        const result = services.helpers.hexToNumber(hex);
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              hex,
              decimal: result.toString()
            }, null, 2)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error converting hex to number: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true
        };
      }
    }
  );

  // Convert number to hex
  server.tool(
    "number_to_hex",
    "Convert decimal number to hexadecimal string",
    {
      number: z.string().describe("Decimal number as string (e.g., '26' converts to '0x1a')")
    },
    async ({ number }) => {
      try {
        if (!number) {
          throw new Error('Number is required');
        }
        const num = parseFloat(number);
        if (isNaN(num)) {
          throw new Error('Invalid number format');
        }
        const result = services.helpers.numberToHex(num);
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              decimal: number,
              hex: result
            }, null, 2)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error converting number to hex: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true
        };
      }
    }
  );
}



