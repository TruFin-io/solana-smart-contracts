import * as anchor from "@coral-xyz/anchor";
import { AnchorProvider, Program, Wallet } from "@coral-xyz/anchor";
import { Keypair, PublicKey } from "@solana/web3.js";
import * as fs from "fs";
import { getConnection, getStakerProgramId } from "./utils";

// Get the Solana connection
const connection = getConnection();

// get config variables
const staker_program_id = new PublicKey(getStakerProgramId());

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

// A script to set the stake manager authority of the staker program.
// This is the account able to increase and decrease validator stake.
// usage: yarn set-stake-manager <old_stake_manager> <new_stake_manager>
async function main() {

  // parse arguments
  const args = process.argv.slice(2);

  const old_stake_manager = args.length === 2 && new PublicKey(args[0]);
  if (!old_stake_manager) {
    console.error("Usage: yarn set-stake-manager <old_stake_manager> <new_stake_manager>");
    process.exit(1);
  }

  const new_stake_manager = args.length === 2 && new PublicKey(args[1]);
  if (!new_stake_manager) {
    console.error("Usage: yarn set-stake-manager <old_stake_manager> <new_stake_manager>");
    process.exit(1);
  }

  // check that "old_stake_manager" is the current stake manager
  const [stakeManagerPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("stake_manager"), old_stake_manager.toBuffer()],
    staker_program_id
  );
  const accountInfo = await provider.connection.getAccountInfo(stakeManagerPDA);
  if (!accountInfo) {
      console.error("Stake Manager PDA not found. The 'old_stake_manager' provided is not the current stake manager.");
      return
  }


  // call set_stake_manager
  const program = await Program.at(staker_program_id, provider);
  const tx = await program.methods
    .setStakeManager()
    .accounts({
      signer: owner_keypair.publicKey,
      newStakeManager: new_stake_manager,
      oldStakeManager: old_stake_manager,
    })
    .signers([owner_keypair])
    .rpc();

  console.log("SetStakeManager tx:", tx);
}

// Run the main function
main().catch((error) => {
    console.error("Unexpected error:", error);
    process.exit(1);
});
