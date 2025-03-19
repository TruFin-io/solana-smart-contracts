import * as anchor from "@coral-xyz/anchor";
import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { Keypair, PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js";
import * as fs from "fs";
import { decodeValidatorListAccount, getStakePool } from "../tests/helpers";
import { StakeStatus } from "../tests/stake_pool/types";
import { getConnection, getStakePoolProgramId, getStakePoolAccount } from "./utils";

// Get the Solana connection
const connection = getConnection();

// get config variables
const stake_pool_program_id = new PublicKey(getStakePoolProgramId());
const stake_pool_account = new PublicKey(getStakePoolAccount());

// load the owner keypair
const owner_keypair = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(fs.readFileSync(`${process.cwd()}/accounts/owner.json`, "utf-8"))) // Replace with your keypair file
);

const provider = new AnchorProvider(
  connection,
  new Wallet(owner_keypair),
  { commitment: "confirmed" }
);
anchor.setProvider(provider);

// A script to cleanup removed validator entries from the stake pool
// usage: yarn cleanup-validators
async function main() {

  // load the keypair of the account that will sign the transaction. It doesn't need to be the owner.
  const user_keypair = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(`${process.cwd()}/accounts/owner.json`, "utf-8")))
  );

  const stakePool = await getStakePool(provider.connection, stake_pool_account);

  const currentEpoch = (await provider.connection.getEpochInfo()).epoch;
  console.log("Current epoch:", currentEpoch);

  const validatorList = await decodeValidatorListAccount(provider.connection, stakePool.validatorList);

  let canCleanup = false;
  validatorList.validators.forEach((validator) => {
    if (validator.status == StakeStatus.ReadyForRemoval) {
      console.log(`Validator: ${validator.vote_account_address.toBase58()} status: ReadyForRemoval`);
      canCleanup = true;
    }
    console.log(`Validator: ${validator.vote_account_address.toBase58()} status: ${validator.status}`);
  });

  if (!canCleanup) {
    console.log("No validators to cleanup");
    return;
  }

  const cleanupIx = new TransactionInstruction({
    programId: stake_pool_program_id,
    keys: [
      { pubkey: stake_pool_account, isSigner: false, isWritable: false }, // Stake pool
      { pubkey: stakePool.validatorList, isSigner: false, isWritable: true }, // validator list
      { pubkey: user_keypair.publicKey, isSigner: true, isWritable: true }, // the signer
    ],
    data: Buffer.from(Uint8Array.of(8)), // CleanupRemovedValidatorEntries instruction index
  });

  // send the CleanupRemovedValidatorEntries transaction
  const tx = new Transaction().add(cleanupIx);
  let txSig = await provider.sendAndConfirm(tx, [user_keypair]);

  console.log("CleanupRemovedValidatorEntries tx:", txSig);
}

// Run the main function
main().catch((error) => {
    console.error("Unexpected error:", error);
    process.exit(1);
});
