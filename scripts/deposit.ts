import * as anchor from "@coral-xyz/anchor";
import { AnchorProvider, BN, Program, Wallet } from "@coral-xyz/anchor";
import { Account, createAssociatedTokenAccountInstruction, getAccount, getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction, TransactionInstruction } from "@solana/web3.js";
import * as fs from "fs";
import * as os from "os";
import { getStakePool } from "../tests/helpers";
import { getConnection, getStakePoolProgramId, getStakerProgramId, getStakePoolAccount } from "./utils";

// Get the Solana connection
const connection = getConnection();

// get config variables
const stake_pool_program_id = new PublicKey(getStakePoolProgramId());
const staker_program_id = new PublicKey(getStakerProgramId());
const stake_pool_account = new PublicKey(getStakePoolAccount());

const owner_keypair = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(fs.readFileSync(`${process.cwd()}/accounts/owner.json`, "utf-8"))) // Replace with your keypair file
);

// Configure the Solana connection and Anchor provider
const provider = new AnchorProvider(connection, new Wallet(owner_keypair), { commitment: "confirmed" });
anchor.setProvider(provider);


// A script to deposit SOL into the pool reserve account.
// If the user does not have a TruSOL associated token account, it will be created.
//
// usage: yarn deposit <user_name> <amount>
//   e.g. yarn deposit carlo 1
// Args:
// <user_name> : name of the user json keypair file in the user home dir (e.g. ~/.config/solana/carlo.json)
// <amount> : the amount of SOL to deposit
async function main() {

  // parse arguments
  const args = process.argv.slice(2);

  const username = args.length === 2 && args[0];
  if (!username) {
    console.error("Usage: yarn deposit <user_name> <amount>");
    process.exit(1);
  }

  const depositAmount = args.length === 2 && new BN(Number(args[1]) * LAMPORTS_PER_SOL);
  if (!depositAmount) {
    console.error("Usage: yarn deposit <user_name>  <amount>");
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

  console.log(`User ${user.publicKey} depositing ${Number(args[1])} SOL...`);

  // Load the program deployed at the specified address
  const program = await Program.at(staker_program_id, provider);
  const stakePool = await getStakePool(connection, stake_pool_account);

  // derive accounts
  const [poolWithdrawAuthority] = PublicKey.findProgramAddressSync(
    [stake_pool_account.toBuffer(), Buffer.from("withdraw")],
    stake_pool_program_id
  );
  const [userWhitelistPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("user"), user.publicKey.toBuffer()],
    program.programId
  );

  let userPoolTokenATA = getAssociatedTokenAddressSync(
    stakePool.poolMint,
    user.publicKey,
  );

  let createAccountIx: TransactionInstruction;
  let tokenAccount: Account;
  try {
    console.log("TruSOL associated token account: ", userPoolTokenATA.toBase58());
    tokenAccount = await getAccount(connection, userPoolTokenATA);
    console.log("Found associated token account. Balance: ", Number(tokenAccount.amount) / 1e9, "TruSOL");
  } catch (error) {
    console.log("TruSOL associated token account not found");
    console.log("Creating TruSOL associated token account at address", userPoolTokenATA.toBase58());

    createAccountIx = createAssociatedTokenAccountInstruction(
      user.publicKey,
      userPoolTokenATA,
      user.publicKey,
      stakePool.poolMint
    )
  }

  // deposit instruction
  const depositIx = await program.methods.deposit(depositAmount)
    .accounts({
      user: user.publicKey,
      userWhitelistAccount: userWhitelistPDA,
      stakePool: stake_pool_account,
      depositAuthority: stakePool.stakeDepositAuthority,
      withdrawAuthority: poolWithdrawAuthority,
      poolReserve:  stakePool.reserveStake,
      userPoolTokenAccount: userPoolTokenATA,
      feeTokenAccount: stakePool.managerFeeAccount,
      poolMint: stakePool.poolMint,
      referralFeeTokenAccount: stakePool.managerFeeAccount,
      tokenProgram: TOKEN_PROGRAM_ID,
      stakerProgram: program.programId,
      systemProgram: SystemProgram.programId,
    })
    .instruction();

  // build the transaction with the create account instruction if needed
  const transaction = new Transaction();
  if (!tokenAccount) {
    console.log("adding instruction to create the associated token account");
    transaction.add(createAccountIx);
  }
  transaction.add(depositIx);

  const txHash = await provider.sendAndConfirm(transaction, [user]);
  console.log("Deposit tx hash:", txHash);
}

// Run the main function
main().catch((error) => {
    console.error("Unexpected error:", error);
    process.exit(1);
});
