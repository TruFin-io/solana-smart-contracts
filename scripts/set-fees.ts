import * as fs from "fs";
import * as borsh from "borsh";
import * as anchor from "@coral-xyz/anchor";
import { Keypair, PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js";
import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { Fee, FeeType, SetFeeInstruction, SetFeeSchema } from "../tests/stake_pool/types";
import { getConnection, getStakePoolProgramId } from "./utils";

// Get the Solana connection
const connection = getConnection();

// get config variables
const stake_pool_program_id = new PublicKey(getStakePoolProgramId());

// load the keypairs
const owner_keypair = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(fs.readFileSync(`${process.cwd()}/accounts/owner.json`, "utf-8")))
);
const manager_keypair = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(fs.readFileSync(`${process.cwd()}/accounts/manager.json`, "utf-8")))
);
const stake_pool_keypair = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(fs.readFileSync(`${process.cwd()}/accounts/stake-pool.json`, "utf-8")))
);


// Configure the Solana connection and Anchor provider
const provider = new AnchorProvider(connection, new Wallet(owner_keypair), { commitment: "confirmed" });
anchor.setProvider(provider);

// A script to set the fees on the stake pool.
// usage: yarn set-fees epoch|sol-deposit||stake-withdrawal <numerator> <denominator>
async function main() {

  // parse arguments
  const args = process.argv.slice(2);
  if (args.length !== 3) {
    console.error("Usage: set-fees epoch|sol-deposit||stake-withdrawal <numerator> <denominator>");
    process.exit(1);
  }

  // Epoch fee -> 2 
  // StakeWithdrawal fee -> 3
  // SolDeposit fee -> 4
  let fee_type: number;
  if (args[0] === "epoch") {
    fee_type = 2;
  } else if (args[0] === "sol-deposit") {
    fee_type = 4;
  } else if (args[0] === "stake-withdrawal") {
    fee_type = 3;
  } else {
    console.error("Invalid fee type. Use epoch, sol-deposit or stake-withdrawal");
    process.exit(1);
  }

  const numerator = Number(args[1]);
  const denominator = Number(args[2]);

  console.log(`Setting ${args[0]} fee to ${numerator}/${denominator}...`);

  // Serialize the instruction data using Borsh
  const data = Buffer.from(
    borsh.serialize(
      SetFeeSchema,
      new SetFeeInstruction({
        instruction: 12, // SetFee instruction index
        feeType: new FeeType({
          type: fee_type,      // Epoch fee
          value: new Fee({ numerator: numerator, denominator: denominator }),
        }),
      })
    )
  );

  //  (Manager only) Update fee
  //  0. `[w]` Stake pool
  //  1. `[s]` Manager
  const setFeeInstruction = new TransactionInstruction({
    programId: stake_pool_program_id,
    keys: [
      { pubkey: stake_pool_keypair.publicKey, isSigner: false, isWritable: true }, // Stake pool
      { pubkey: manager_keypair.publicKey, isSigner: true, isWritable: false }, // Manager
    ],
    data: data,
  });

  // Add the instruction to a transaction
  const setFeeTransaction = new Transaction().add(setFeeInstruction);

  // Send and confirm the transaction
  const txHash = await provider.sendAndConfirm(setFeeTransaction,
    [manager_keypair], {
    commitment: "confirmed",
  });

  console.log("SetFee tx:", txHash);
}

// Run the main function
main().catch((error) => {
  console.error("Unexpected error:", error);
  process.exit(1);
});
