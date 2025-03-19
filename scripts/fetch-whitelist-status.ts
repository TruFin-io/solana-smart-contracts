import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { Keypair, PublicKey } from "@solana/web3.js";
import * as borsh from "borsh";
import * as fs from "fs";
import { getConnection, getStakerProgramId } from "./utils";

// Get the Solana connection
const connection = getConnection();

// get config variables
const staker_program_id = new PublicKey(getStakerProgramId());

const owner_keypair = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(fs.readFileSync(`${process.cwd()}/accounts/owner.json`, "utf-8"))) // Replace with your keypair file
);

// Configure the Anchor provider
const provider = new AnchorProvider(
  connection,
  new Wallet(owner_keypair),
  { commitment: "confirmed" }
);

/// A script to fetch the whitelist status of a user
// usage: yarn fetch-whitelist-status <user_address>
async function main() {

    // parse arguments
    const args = process.argv.slice(2);
    const user = args.length === 1 && new PublicKey(args[0])
    if (!user) {
      console.error("Usage: yarn is-agent <user_address>");
      process.exit(1);
    }

    // derive the user whitelist PDA
    const [userWhitelistPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("user"), user.toBuffer()],
      staker_program_id
    );
    console.log("User address:", user.toBase58());
    console.log("User whitelist PDA:", userWhitelistPDA.toBase58());

    const whitelistAccountInfo = await provider.connection.getAccountInfo(userWhitelistPDA);
    if (!whitelistAccountInfo) {
        console.error("User whitelist PDA not found. The user is not whitelisted");
        return
    }

    // deserialize the user whitelist status
    const userStatus = borsh.deserialize(UserStatusSchema, UserStatus, whitelistAccountInfo.data.subarray(8));
    console.log("Whitelist status:",
      userStatus.status === 0 ? "None" :
      userStatus.status === 1 ? "WHITELISTED" :
       "BLACKLISTED"
    );
}

// Run the main function
main().catch((error) => {
    console.error("Unexpected error:", error);
    process.exit(1);
});


enum WhitelistUserStatus {
  None = 0,
  Whitelisted = 1,
  Blacklisted = 2,
}

class UserStatus {
  status: WhitelistUserStatus;

  constructor(fields: { status: WhitelistUserStatus }) {
    this.status = fields.status;
  }
}

// Borsh schema
const UserStatusSchema = new Map([
  [
    UserStatus,
    {
      kind: "struct",
      fields: [["status", "u8"]], // Enum stored as u8
    },
  ],
]);
