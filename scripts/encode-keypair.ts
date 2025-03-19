import * as fs from "fs";
import { bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";
import { Keypair } from "@solana/web3.js";

// A script to encode in Base58 a keypair file
// usage: yarn encode-keypair <keypair_path>

// parse arguments
const args = process.argv.slice(2);
const keypair_path = args.length === 1 && args[0]
if (!keypair_path) {
    console.error("Usage: yarn encode-keypair <keypair_path>");
    process.exit(1);
}

const keypair = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(keypair_path, "utf-8")))
);
  
async function main() {
    const keypairBase58 = bs58.encode(keypair.secretKey);
    console.log("Encoded keypair:", keypairBase58);
}

main().catch((error) => {
    console.error("Unexpected error:", error);
    process.exit(1);
});
