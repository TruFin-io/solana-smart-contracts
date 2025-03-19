import * as anchor from "@coral-xyz/anchor";
import { AnchorProvider, Program, Wallet } from "@coral-xyz/anchor";
import { Keypair, PublicKey, Transaction } from "@solana/web3.js";
import * as fs from "fs";
import os from "os";
import { getConnection, getStakerProgramId } from "./utils";

// get config variables
const staker_program_id = new PublicKey(getStakerProgramId());


// A script to claim ownership of the staker program.
// usage: yarn claim-ownership <pending_owner_name>
async function main() {

  // parse arguments
  const args = process.argv.slice(2);

  const pending_owner_name = args.length === 1 && args[0];
  if (!pending_owner_name) {
    console.error("Usage: yarn claim-ownership <pending_owner_name>");
    process.exit(1);
  }

  // find pending_owner keypair file under ~/.config/solana/
  const pending_owner_keypair_file = `${os.homedir()}/.config/solana/${pending_owner_name}.json`;
  console.log("pending_owner_keypair_file:", pending_owner_keypair_file);
  if (!fs.existsSync(pending_owner_keypair_file)) {
    console.error(`Keypair file ${pending_owner_name}.json not found under ${os.homedir()}/.config/solana/`);
    process.exit(1);
  }

  // load the pending owner keypair
  const pending_owner_keypair = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(pending_owner_keypair_file, "utf-8")))
  );

  // configure the Anchor provider
  const connection = getConnection();
  const provider = new AnchorProvider(connection, new Wallet(pending_owner_keypair), { commitment: "confirmed" });
  anchor.setProvider(provider);

  // build claim_ownership instruction
  const program = await Program.at(staker_program_id, provider);
  const claimOwnershipIx = await program.methods
    .claimOwnership()
    .signers([pending_owner_keypair])
    .instruction();

  // send the transaction
  const claimOwnershipTx = new Transaction().add(claimOwnershipIx);
  let tx = await provider.sendAndConfirm(claimOwnershipTx, [pending_owner_keypair]);
  
  console.log("ClaimOwnership tx:", tx);
}

// Run the main function
main().catch((error) => {
    console.error("Unexpected error:", error);
    process.exit(1);
});
