import { ASSOCIATED_TOKEN_PROGRAM_ID, getAccount, getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Keypair, PublicKey } from "@solana/web3.js";
import * as fs from "fs";
import * as os from "os";
import { getStakePool } from "../tests/helpers";
import { getConnection, getStakePoolAccount } from "./utils";

// Get the Solana connection
const connection = getConnection();

// get config variables
const stake_pool_account = new PublicKey(getStakePoolAccount());

// A script to fetch the max amount of SOL a user can withdraw based on his TruSOL balance and current share price.
// usage: yarn fetch-max-withdraw <user_name>
async function main() {

  const args = process.argv.slice(2);
  const username = args.length === 1 && args[0];
  if (!username) {
    console.error("Usage: yarn fetch-max-withdraw <user_name>");
    process.exit(1);
  }

  // get user keypair
  const user_keypair_file = `${os.homedir()}/.config/solana/${username}.json`;
  if (!fs.existsSync(user_keypair_file)) {
    console.error(`Keypair file ${username}.json not found under ${os.homedir()}/.config/solana/`);
    process.exit(1);
  }
  const user = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(user_keypair_file, "utf-8")))
  );

  const stakePool = await getStakePool(connection, stake_pool_account);
  const sharePrice = Number(stakePool.totalLamports) / Number(stakePool.poolTokenSupply);

  let truSolATA = getAssociatedTokenAddressSync(
    stakePool.poolMint,
    user.publicKey,
    false,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );

  const truSolTokenAccount = await getAccount(connection, truSolATA);
  const maxWithdraw = Math.round(Number(truSolTokenAccount.amount) * sharePrice);
  console.log("TruSOL balance: ", Number(truSolTokenAccount.amount) / 1e9, "TruSOL");
  console.log("Share price:", sharePrice);
  console.log("Max withdraw:", maxWithdraw,` lamports. (${maxWithdraw / 1e9} SOL)`);
}

main().catch((error) => {
  console.error("Unexpected error:", error);
  process.exit(1);
});
