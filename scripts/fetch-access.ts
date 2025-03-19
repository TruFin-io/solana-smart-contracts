import * as anchor from "@coral-xyz/anchor";
import { AnchorProvider, Program, Wallet } from "@coral-xyz/anchor";
import { Keypair, PublicKey } from "@solana/web3.js";
import * as fs from "fs";
import { getConnection, getStakerProgramId } from "./utils";

// Get the Solana connection
const connection = getConnection();

// get config variables
const staker_program_id = new PublicKey(getStakerProgramId());
const owner_keypair = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(fs.readFileSync(`${process.cwd()}/accounts/owner.json`, "utf-8")))
);
const provider = new AnchorProvider(
  connection,
  new Wallet(owner_keypair),
  { commitment: "confirmed" }
);
anchor.setProvider(provider);

// A script to fetch the access info
async function main() {

    // derive access PDA
    const [accessAddress] = PublicKey.findProgramAddressSync([Buffer.from("access")], staker_program_id);
    console.log("access PDA:", accessAddress.toString());

    const program = await Program.at(staker_program_id, provider);
    const account = program.account as any
    const access = await account.access.fetch(accessAddress) as any;

    console.log("owner:", access.owner.toBase58());
    console.log("pending_owner:", access.pendingOwner ? access.pendingOwner.toBase58() : "none");
    console.log("stake_manager:", access.stakeManager.toBase58());
    console.log("is_paused:", access.isPaused);
}

// Run the main function
main().catch((error) => {
    console.error("Unexpected error:", error);
    process.exit(1);
});

