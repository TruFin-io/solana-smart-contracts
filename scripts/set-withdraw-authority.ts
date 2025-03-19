import * as anchor from "@coral-xyz/anchor";
import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
import {
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction
} from "@solana/web3.js";
import * as fs from "fs";
import { FundingType } from "../tests/stake_pool/types";
import { getConnection, getStakePoolProgramId, getStakePoolAccount } from "./utils";

// Get the Solana connection
const connection = getConnection();

// get config variables
const stake_pool_program_id = new PublicKey(getStakePoolProgramId());
const stake_pool_account = new PublicKey(getStakePoolAccount());

// load the owner keypair
const owner_keypair = Keypair.fromSecretKey(
  Uint8Array.from(
    JSON.parse(fs.readFileSync(`${process.cwd()}/accounts/owner.json`, "utf-8"))
  )
);

// load the manager keypair
const manager_keypair = Keypair.fromSecretKey(
  Uint8Array.from(
    JSON.parse(
      fs.readFileSync(`${process.cwd()}/accounts/manager.json`, "utf-8")
    )
  )
);

// Configure the Solana connection and Anchor provider
const provider = new AnchorProvider(connection, new Wallet(owner_keypair), {
  commitment: "confirmed",
});
anchor.setProvider(provider);

// A script to set a withdraw authority for the staker. At the moment, it will set it to the current withdraw authority.
// usage: yarn set-withdraw-authority
async function main() {

  // derive the withdraw authority (PDA)
  const [poolWithdrawAuthorityPDA] = PublicKey.findProgramAddressSync(
    [stake_pool_account.toBuffer(), Buffer.from("withdraw")],
    stake_pool_program_id
  );

  // set a withdraw authority
  const addFundingAuthorityix = new TransactionInstruction({
    programId: stake_pool_program_id,
    keys: [
      {
        pubkey: stake_pool_account,
        isSigner: false,
        isWritable: true,
      }, // Stake pool account
      { pubkey: manager_keypair.publicKey, isSigner: true, isWritable: false }, // Manager
      { pubkey: poolWithdrawAuthorityPDA, isSigner: false, isWritable: false }, // Withdraw authority
    ],
    data: Buffer.concat([
      Buffer.from(Uint8Array.of(15)), // Instruction index for SetFundingAuthority
      Buffer.from(Uint8Array.of(FundingType.SolWithdraw)), // Set the SOL withdraw authority
    ]),
  });

  const addFundingAuthoritytx = new Transaction().add(addFundingAuthorityix);
  const tx = await provider.sendAndConfirm(addFundingAuthoritytx, [
    manager_keypair,
  ]);
  console.log("Withdraw Authority set tx:", tx);
}

// Run the main function
main().catch((error) => {
  console.error("Unexpected error:", error);
  process.exit(1);
});
