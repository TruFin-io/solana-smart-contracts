import * as anchor from "@coral-xyz/anchor";
import { AnchorProvider, Program, Wallet } from "@coral-xyz/anchor";
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import * as fs from "fs";
import { getConnection, getStakerProgramId } from "./utils";

// Get the Solana connection
const connection = getConnection();

// get config variables
const staker_program_id = new PublicKey(getStakerProgramId());

const owner_keypair = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(fs.readFileSync(`${process.cwd()}/accounts/owner.json`, "utf-8")))
);

// Configure the Anchor provider
const provider = new AnchorProvider(
  connection,
  new Wallet(owner_keypair),
  { commitment: "confirmed" }
);
anchor.setProvider(provider);


// A script to initialize the Staker contract
// usage: yarn init-staker
async function main() {
  // derive PDAs
  const [accessPDA] = PublicKey.findProgramAddressSync([Buffer.from("access")], staker_program_id);
  const [ownerAgentPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("agent"), owner_keypair.publicKey.toBuffer()],
    staker_program_id
  );

  // Initialize the Staker setting the owner as the staker manager authority
  const program = await Program.at(staker_program_id, provider);
  const txHash = await program.methods
    .initializeStaker()
    .accounts({
      signer: owner_keypair.publicKey,
      access: accessPDA,
      ownerAgentAccount: ownerAgentPDA,
      ownerInfo: owner_keypair.publicKey,
      stakeManagerInfo: owner_keypair.publicKey,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .signers([owner_keypair])
    .rpc();

  console.log("Init Staker tx:", txHash);
}

// Run the main function
main().catch((error) => {
    console.error("Unexpected error:", error);
    process.exit(1);
});
