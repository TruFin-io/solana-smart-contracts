import * as anchor from "@coral-xyz/anchor";
import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { Keypair, PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js";
import * as fs from "fs";
import { getConnection, getStakePoolAccount, getStakePoolProgramId, getStakerProgramId } from "./utils";

// Get the Solana connection
const connection = getConnection();

// get config variables
const staker_program_id = new PublicKey(getStakerProgramId());
const stake_pool_program_id = new PublicKey(getStakePoolProgramId());
const stake_pool_account = new PublicKey(getStakePoolAccount());

// load the owner keypair
const owner_keypair = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(fs.readFileSync(`${process.cwd()}/accounts/owner.json`, "utf-8")))
);

// configure the Anchor provider
const provider = new AnchorProvider(
  connection,
  new Wallet(owner_keypair),
  { commitment: "confirmed" }
);
anchor.setProvider(provider);

// A script to set the Pool "staker" authority to be the "staker" PDA of the Staker contract.
// This is needed to allow the Staker program to manage the pool validators and validators' stake.
// usage: yarn set-pool-staker
async function main() {

  const PROJECT_DIR = process.cwd();
  const manager_keypair = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(`${PROJECT_DIR}/accounts/manager.json`, "utf-8")))
  );

  // derive the staker authority PDA
  const [stakerAuthorityPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("staker")],
    staker_program_id
  );

  // sets stakerAuthorityPDA as the new staker authority of the pool
  const setStakerIx = new TransactionInstruction({
    programId: stake_pool_program_id,
    keys: [
      { pubkey: stake_pool_account, isSigner: false, isWritable: true }, // Stake pool
      { pubkey: manager_keypair.publicKey, isSigner: true, isWritable: false }, // Manager
      { pubkey: stakerAuthorityPDA, isSigner: false, isWritable: false }, // The new pool staker authority
    ],
    data: Buffer.from(Uint8Array.of(13)), // SetStaker instruction index
  });

  const setStakerTx = new Transaction().add(setStakerIx);
  let tx = await provider.sendAndConfirm(setStakerTx, [manager_keypair]);

  console.log("SetStaker tx:", tx);
}

// Run the main function
main().catch((error) => {
    console.error("Unexpected error:", error);
    process.exit(1);
});
