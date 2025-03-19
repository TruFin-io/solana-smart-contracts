// Define the cluster URLs with type definitions
export type NETWORK = "devnet" | "testnet" | "mainnet";
export const RPC_URI: Record<NETWORK, string> = {
    devnet: "https://api.devnet.solana.com",
    testnet: "https://api.testnet.solana.com",
    mainnet: "https://api.mainnet-beta.solana.com"
};
