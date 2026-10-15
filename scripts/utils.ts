import * as dotenv from "dotenv";
import { BN } from "@coral-xyz/anchor";
import { Connection } from "@solana/web3.js";
import { RPC_URI, NETWORK } from "./rpc-endpoints";

// Load environment variables from .env file
dotenv.config();

export function getConnection(): Connection {
    // Determine the Solana cluster URL based on the ENV variable
    const env = (process.env.ENV as NETWORK);
    if (!RPC_URI[env]) {
      throw new Error(`No RPC endpoint configured for environment: ${env}`);
  }
    const rpcUri = RPC_URI[env];
    return new Connection(rpcUri, "confirmed");
}

export const getStakePoolProgramId = () => {
  if (!process.env.STAKE_POOL_PROGRAM_ID) {
      throw new Error('STAKE_POOL_PROGRAM_ID not set in environment');
  }
  return process.env.STAKE_POOL_PROGRAM_ID;
}
export const getStakerProgramId = () => {
  if (!process.env.STAKER_PROGRAM_ID) {
      throw new Error('STAKER_PROGRAM_ID not set in environment');
  }
  return process.env.STAKER_PROGRAM_ID;
}
export const getStakePoolAccount = () => {
  if (!process.env.STAKE_POOL_ACCOUNT) {
      throw new Error('STAKE_POOL_ACCOUNT not set in environment');
  }
  return process.env.STAKE_POOL_ACCOUNT;
}  

// Parses a CLI argument that must be a u64 (a non-negative integer below 2^64), as the stake
// seeds are; exits with a usage error otherwise.
export function parseU64Arg(name: string, value: string): BN {
  if (!/^\d+$/.test(value) || new BN(value).bitLength() > 64) {
    console.error(`${name} must be a non-negative integer below 2^64, got "${value}"`);
    process.exit(1);
  }
  return new BN(value);
}
