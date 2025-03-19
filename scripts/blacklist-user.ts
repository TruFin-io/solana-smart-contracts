import * as anchor from "@coral-xyz/anchor";
import * as fs from "fs";
import { Keypair, PublicKey, Transaction } from "@solana/web3.js";
import { AnchorProvider, Program, Wallet } from "@coral-xyz/anchor";
import { getConnection, getStakerProgramId } from "./utils";


// Get the Solana connection
const connection = getConnection();

// get config variables
const staker_program_id = new PublicKey(getStakerProgramId());

// load the owner keypair
const owner_keypair = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(fs.readFileSync(`${process.cwd()}/accounts/owner.json`, "utf-8"))) // Replace with your keypair file
);

// configure the Anchor provider
const provider = new AnchorProvider(
  connection,
  new Wallet(owner_keypair), 
  { commitment: "confirmed" }
);
anchor.setProvider(provider);

// A script to blacklist a user
// usage: yarn blacklist-user <user_address>
async function main() {

  // parse argumets
  const args = process.argv.slice(2);
  const user = args.length === 1 && new PublicKey(args[0])
  if (!user) {
    console.error("Usage: yarn blacklist-user <user_address>");
    process.exit(1);
  }

  // Add user to blacklist
  const program = await Program.at(staker_program_id, provider);
  const blacklistIx = await program.methods
    .addUserToBlacklist(user)
    .accounts({
      signer: owner_keypair.publicKey,
    })
    .signers([owner_keypair])
    .instruction();

  const blacklistTx = new Transaction().add(blacklistIx);
  const tx = await provider.sendAndConfirm(blacklistTx, [owner_keypair]);

  console.log("Blacklist user tx:", tx);
}

// Run the main function
main().catch((error) => {
    console.error("Unexpected error:", error);
    process.exit(1);
});
