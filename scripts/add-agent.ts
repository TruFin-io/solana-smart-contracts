import * as anchor from "@coral-xyz/anchor";
import { AnchorProvider, Program, Wallet } from "@coral-xyz/anchor";
import { Keypair, PublicKey, Transaction } from "@solana/web3.js";
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


// A script to add a new agent
// usage: yarn add-agent <new_agent_address>
async function main() {

  // parse arguments
  const args = process.argv.slice(2);
  const newAgent = args.length === 1 && new PublicKey(args[0])
  if (!newAgent) {
    console.error("Usage: yarn add-agent <new_agent_address>");
    process.exit(1);
  }

  // Load the program deployed at the specified address
  const program = await Program.at(staker_program_id, provider);

  // Add a new agent
  console.log(`Adding agent ${newAgent.toBase58()}...`);
  const addAgentIx = await program.methods
    .addAgent(newAgent)
    .accounts({
      signer: owner_keypair.publicKey,
    })
    .signers([owner_keypair])
    .instruction();

  // console.log("AddAgent instruction:", addAgentIx);

  const addAgentTx = new Transaction().add(addAgentIx);
  let tx = await provider.sendAndConfirm(addAgentTx, [owner_keypair]);
  
  console.log("AddAgent tx:", tx);

}

// Run the main function
main().catch((error) => {
    console.error("Unexpected error:", error);
    process.exit(1);
});
