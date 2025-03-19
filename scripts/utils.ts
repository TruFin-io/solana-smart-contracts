import * as dotenv from "dotenv";
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
