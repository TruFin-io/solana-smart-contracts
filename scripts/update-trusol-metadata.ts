import * as anchor from "@coral-xyz/anchor";
import * as fs from "fs";
import { Keypair, PublicKey, Transaction } from "@solana/web3.js";
import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { updatePoolTokenMetadata } from "@solana/spl-stake-pool";
import { getConnection, getStakePoolAccount } from "./utils";

// Token Metadata Account 
// FNLGPonzqG9j3vyMF2XC9VLXATF1cwbumPMfyHPYNVT1

// get config variables
const stake_pool_account = new PublicKey(getStakePoolAccount());

// load the owner keypair
const owner_keypair = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(fs.readFileSync(`${process.cwd()}/accounts/owner.json`, "utf-8")))
);

const manager_keypair = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(fs.readFileSync(`${process.cwd()}/accounts/manager.json`, "utf-8")))
);

// Get the Solana connection
const connection = getConnection();
const provider = new AnchorProvider(connection, new Wallet(owner_keypair),
  { commitment: "confirmed" }
);
anchor.setProvider(provider);

console.log("manager:", manager_keypair.publicKey.toBase58());

// A script to update the metadata for the TruSOL token
// usage: yarn update-trusol-metadata
async function main() {

  // get the update pool token metadata instruction
  let ixs = await updatePoolTokenMetadata(
    provider.connection as any,
    stake_pool_account, // stake pool account
    "TruSOL Token", // token name
    "TruSOL",        // token symbol
    "https://www.trufin.io" // token metadata uri
  );

  // add the instructions to a transaction
  const updateMetadataTx = new Transaction();
  let updateIx = ixs.instructions[0];
  updateMetadataTx.add(updateIx);

  // send the transaction
  const txHash = await provider.sendAndConfirm(updateMetadataTx, [manager_keypair]);
  console.log("UpdatePoolTokenMetadata tx:", txHash);
}

// Run the main function
main().catch((error) => {
    console.error("Unexpected error:", error);
    process.exit(1);
});

  
