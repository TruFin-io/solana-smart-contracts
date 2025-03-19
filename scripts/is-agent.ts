import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { Keypair, PublicKey } from "@solana/web3.js";
import * as fs from "fs";
import { getConnection, getStakerProgramId } from "./utils";

// Get the Solana connection
const connection = getConnection();

// get config variables
const staker_program_id = new PublicKey(getStakerProgramId());
const owner_keypair = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(fs.readFileSync(`${process.cwd()}/accounts/owner.json`, "utf-8"))) // Replace with your keypair file
);

const provider = new AnchorProvider(
  connection,
  new Wallet(owner_keypair),
  { commitment: "confirmed" }
);

// A script to check if a user is an agent
// usage: yarn is-agent <user_address>
async function main() {
  // parse arguments
  const args = process.argv.slice(2);
  const user = args.length === 1 && new PublicKey(args[0])
  if (!user) {
    console.error("Usage: yarn is-agent <user_address>");
    process.exit(1);
  }

  // derive the agent PDA
  const [agentPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("agent"), user.toBuffer()],
    staker_program_id
  );

  console.log("User address:", user.toBase58());
  console.log("Agent PDA:", agentPDA.toBase58());
  const accountInfo = await provider.connection.getAccountInfo(agentPDA);
  if (!accountInfo) {
      console.log("Agent PDA not found. The user is not an agent");
      return
  }

  console.log("The user is an agent");
}

// Run the main function
main().catch((error) => {
    console.error("Unexpected error:", error);
    process.exit(1);
});
