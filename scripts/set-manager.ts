import * as fs from "fs";
import * as os from "os";
import * as anchor from "@coral-xyz/anchor";
import { Keypair, PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js";
import { getOrCreateAssociatedTokenAccount } from "@solana/spl-token";
import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { getStakePool } from "../tests/helpers";
import { getConnection, getStakePoolProgramId, getStakePoolAccount } from "./utils";

// Get the Solana connection
const connection = getConnection();

// get config variables
const stake_pool_program_id = new PublicKey(getStakePoolProgramId());
const stake_pool_account = new PublicKey(getStakePoolAccount());

// load the keypairs
const manager_keypair = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(`${process.cwd()}/accounts/manager.json`, "utf-8")))
);
  
// configure the Anchor provider
const provider = new AnchorProvider(connection, new Wallet(manager_keypair), { commitment: "confirmed" });
anchor.setProvider(provider);
  

// A script to set the manager of the stake pool program.
// This is the account able to set the pool fees and the token account that receives the fees every epoch.
// usage: yarn set-manager <new_manager_name>
async function main() {

  // parse arguments
  const args = process.argv.slice(2);
  const new_manager_name = args[0];
  if (!new_manager_name) {
    console.error("Usage: yarn set-manager <new_manager_name>");
    process.exit(1);
  }

  // get new manager keypair
  const new_manager_keypair_file = `${os.homedir()}/.config/solana/${new_manager_name}.json`;
  if (!fs.existsSync(new_manager_keypair_file)) {
    console.error(`Keypair file ${new_manager_name}.json not found under ${os.homedir()}/.config/solana/`);
    process.exit(1);
  }
  const new_manager_keypair = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(new_manager_keypair_file, "utf-8")))
  );

  // create the new manager's associated token account that will collect fees
  const stakePool = await getStakePool(connection, stake_pool_account);
  
  const newManagerFeesAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    new_manager_keypair, // payer of the transaction and initialization fees
    stakePool.poolMint,
    new_manager_keypair.publicKey // owner who Fee token account who will receive the fees (manager)
  );

  const newManagerFeesAddress = newManagerFeesAccount.address;
  console.log("Current manager:", stakePool.manager.toBase58());
  console.log("New manager:", new_manager_keypair.publicKey.toBase58());
  console.log("New manager fees account:", newManagerFeesAddress.toBase58());

  //  (Manager only) Update manager
  //  0. `[w]` Stake pool
  //  1. `[s]` Manager
  //  2. `[s]` New manager
  //  3. `[]` New manager fee account
  const setManagerIx = new TransactionInstruction({
    programId: stake_pool_program_id,
    keys: [
      { pubkey: stake_pool_account, isSigner: false, isWritable: true }, // Stake pool
      { pubkey: stakePool.manager, isSigner: true, isWritable: false }, // Manager
      { pubkey: new_manager_keypair.publicKey, isSigner: true, isWritable: false }, // New manager
      { pubkey: newManagerFeesAddress, isSigner: false, isWritable: false }, // New manager fee account

    ],
    data: Buffer.from(Uint8Array.of(11)), // Instruction index for SetManager
  });

  const setManagerTx = new Transaction().add(setManagerIx);
  let tx = await provider.sendAndConfirm(setManagerTx, [manager_keypair, new_manager_keypair]);

  console.log("SetManager tx:", tx);
}

// Run the main function
main().catch((error) => {
    console.error("Unexpected error:", error);
    process.exit(1);
});
