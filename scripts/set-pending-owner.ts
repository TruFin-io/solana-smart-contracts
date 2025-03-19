import * as anchor from "@coral-xyz/anchor";
import { AnchorProvider, Program, Wallet } from "@coral-xyz/anchor";
import { Keypair, PublicKey, Transaction } from "@solana/web3.js";
import * as fs from "fs";
import { getConnection, getStakerProgramId } from "./utils";

// get config variables
const staker_program_id = new PublicKey(getStakerProgramId());

// load the owner keypair
const owner_keypair = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(fs.readFileSync(`${process.cwd()}/accounts/owner.json`, "utf-8")))
);

// configure the Anchor provider
const connection = getConnection();
const provider = new AnchorProvider(connection, new Wallet(owner_keypair), { commitment: "confirmed" });
anchor.setProvider(provider);


// A script to set the new pending owner of the staker program.
// usage: yarn set-pending-owner <new_pending_manager>
async function main() {

  // parse arguments
  const args = process.argv.slice(2);

  const new_pending_owner = args.length === 1 && new PublicKey(args[0]);
  if (!new_pending_owner) {
    console.error("Usage: yarn set-pending-owner <new_pending_owner>");
    process.exit(1);
  }

  // build set_pending_owner instruction
  const program = await Program.at(staker_program_id, provider);
  const setPendingOwnerIx = await program.methods
    .setPendingOwner(new_pending_owner)
    .signers([owner_keypair])
    .instruction();

    // console.log("SetPendingOwner instruction:", setPendingOwnerIx);

    const setPendingOwnerTx = new Transaction().add(setPendingOwnerIx);
    let tx = await provider.sendAndConfirm(setPendingOwnerTx, [owner_keypair]);
    console.log("SetPendingOwner tx:", tx);

}

// Run the main function
main().catch((error) => {
    console.error("Unexpected error:", error);
    process.exit(1);
});
