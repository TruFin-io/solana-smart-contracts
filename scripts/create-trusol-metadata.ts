import * as anchor from "@coral-xyz/anchor";
import * as fs from "fs";
import { Keypair, PublicKey, Transaction } from "@solana/web3.js";
import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { createPoolTokenMetadata } from "@solana/spl-stake-pool";

// Token Metadata Account
// FNLGPonzqG9j3vyMF2XC9VLXATF1cwbumPMfyHPYNVT1

import { getConnection, getStakePoolAccount } from "./utils";

// Get the Solana connection
const connection = getConnection();

// get config variables
const stake_pool_account = new PublicKey(getStakePoolAccount());

// load the owner keypair
const owner_keypair = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(fs.readFileSync(`${process.cwd()}/accounts/owner.json`, "utf-8")))
);

const manager_keypair = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(fs.readFileSync(`${process.cwd()}/accounts/manager.json`, "utf-8")))
);

const provider = new AnchorProvider(connection, new Wallet(owner_keypair),
  { commitment: "confirmed" }
);
anchor.setProvider(provider);

console.log("manager:", manager_keypair.publicKey.toBase58());

// A script to create the metadata for the TruSOL token
// usage: yarn create-trusol-metadata
async function main() {

  // create the pool token metadata instruction
  let ixs = await createPoolTokenMetadata(
    provider.connection as any,
    stake_pool_account, // stake pool account
    manager_keypair.publicKey, // payer
    "TruSOL Liquid Staking Token", // token name
    "TruSOL",        // token symbol
    "https://trufin.io" // token metadata uri
  );

  // add the instructions to a transaction
  let createIx = ixs.instructions[0];
  const createMetadataTx = new Transaction();
  createMetadataTx.add(createIx);

  // send the transaction
  const txHash = await provider.sendAndConfirm(createMetadataTx, [manager_keypair]);

  console.log("CreatePoolTokenMetadata tx:", txHash);
}

// Run the main function
main().catch((error) => {
    console.error("Unexpected error:", error);
    process.exit(1);
});
