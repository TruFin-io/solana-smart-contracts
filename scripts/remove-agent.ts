import * as anchor from "@coral-xyz/anchor";
import { Keypair, PublicKey, Transaction } from "@solana/web3.js";
import { AnchorProvider, Program, Wallet } from "@coral-xyz/anchor";
import * as fs from "fs";
import { getConnection, getStakerProgramId } from "./utils";

// Get the Solana connection
const connection = getConnection();

// get config variables
const staker_program_id = new PublicKey(getStakerProgramId());

const owner_keypair = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(fs.readFileSync(`${process.cwd()}/accounts/owner.json`, "utf-8"))) // Replace with your keypair file
);

// Configure the Solana connection and Anchor provider
const provider = new AnchorProvider(connection, new Wallet(owner_keypair), { commitment: "confirmed" });
anchor.setProvider(provider);


// A script to remove a new agent
// usage: yarn remove-agent <agent_address>
async function main() {

  // parse argumets
  const args = process.argv.slice(2);
  const agent = args.length === 1 && new PublicKey(args[0])
  if (!agent) {
    console.error("Usage: yarn remove-agent <agent_address>");
    process.exit(1);
  }

  // Load the program deployed at the specified address
  const program = await Program.at(staker_program_id, provider);

  // Remove an agent
  console.log(`Removing agent ${agent.toBase58()}...`);

  const removeAgentIx = await program.methods
    .removeAgent(agent)
    .accounts({
      signer: owner_keypair.publicKey,
    })
    .signers([owner_keypair])
    .instruction();

  const removeAgentTx = new Transaction().add(removeAgentIx);
  const tx = await provider.sendAndConfirm(removeAgentTx, [owner_keypair]);

  console.log("removeAgent tx:", tx);
}

// Run the main function
main().catch((error) => {
    console.error("Unexpected error:", error);
    process.exit(1);
});
