import * as anchor from "@coral-xyz/anchor";
import { BN } from "@coral-xyz/anchor";
import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  StakeProgram,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { Staker } from "../target/types/staker";
import {
  STAKE_POOL_PROGRAM_ID,
  initStaker,
  createStakePool,
  addUserToWhitelist,
  requestAirdrop,
  setupConfirmedProvider,
  getEvent,
  findEphemeralStakeAccount,
  findTransientStakeAccount,
  findValidatorStakeAccount,
  randomStakeSeed,
  moveEpochForward,
  moveEpochForwardAndUpdatePool,
  buildUpdateValidatorListBalanceIx,
  updatePoolStakeBalance,
  getValidatorStakeInfo,
  hasTransientStake,
  recordedTransientStakeSeed,
  transientStakeSeedFor,
  simulateExpectingLog,
} from "./helpers";
import { CreateStakePoolResponse } from "./stake_pool/types";

import { assert } from "chai";
import {
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddress,
} from "@solana/spl-token";

/**
 * Immunefi #94595 (issue #159) - hardcoded transient stake seed.
 *
 * The validator-specific paths (deposit_to_specific_validator / increase / decrease) used to pass
 * transient stake seed 0 to SPL Stake Pool's additional-stake instructions. The transient PDA is
 * per-validator ("transient", vote, pool, seed) and SPL creates it with System Allocate + Assign
 * whenever the validator list says no transient stake is in flight. Allocate rejects an address
 * that already has data or a non-system owner.
 *
 * Epoch maintenance (UpdateValidatorListBalance, no_merge = false) merges a matured transient into
 * the validator stake account. That leaves the PDA stake-owned, 200 bytes long and with 0
 * lamports, which the runtime only discards at the end of the transaction. Anyone can append a
 * transfer of the stake-account rent to that same permissionless transaction, after which the PDA
 * survives. The list then records no transient (and maintenance never touches the address again),
 * so every later seed-0 Allocate fails with "already in use": the three instructions were dead for
 * that validator until a program upgrade.
 *
 * The fix takes `transient_seed: u64` from the caller, exactly like `ephemeral_seed`. SPL enforces
 * the rule: while transient stake is in flight the seed must be the one recorded in the validator
 * list, otherwise any seed never used for this validator works. Clients pick that fresh seed at
 * random (`transientStakeSeedFor` in helpers.ts), as they already do for the ephemeral seed, so a
 * refilled address is simply left behind and nobody can line up the next one in advance.
 *
 * The first three tests reproduce the trigger against each instruction and prove the
 * route-around. The fourth checks the "must match the recorded seed" rule on every path, and the
 * last one that remove_validator has to be given the recorded transient account, not seed 0.
 */
describe("transient stake seed poisoning is mitigated by seed rotation (Immunefi #94595)", () => {
  const provider = setupConfirmedProvider();
  const connection = provider.connection;

  let program: anchor.Program<Staker>;
  let owner: anchor.Wallet;
  let manager: Keypair;
  let stakeManager: Keypair;
  let user: Keypair;
  let attacker: Keypair;

  let stakerAuthorityPDA: PublicKey;
  let stakePoolInfo: CreateStakePoolResponse;
  let validatorVoteAccount: PublicKey;
  let validatorStakeAccount: PublicKey;
  let userPoolTokenATA: PublicKey;
  let stakeRent: number;

  before(async () => {
    owner = provider.wallet as anchor.Wallet;
    manager = Keypair.generate();
    stakeManager = Keypair.generate();
    user = Keypair.generate();
    attacker = Keypair.generate();

    await requestAirdrop(connection, user.publicKey, 20);
    await requestAirdrop(connection, attacker.publicKey, 5); // a few rent-exempt balances + fees

    stakeRent = await connection.getMinimumBalanceForRentExemption(StakeProgram.space);

    // pick a local validator vote account
    const voteAccounts = (await connection.getVoteAccounts())?.current;
    if (!voteAccounts || voteAccounts.length === 0) {
      throw new Error("No vote account found");
    }
    validatorVoteAccount = new anchor.web3.PublicKey(voteAccounts[0].votePubkey);

    program = await initStaker(owner.publicKey, stakeManager.publicKey);

    const staker = Keypair.generate();
    stakePoolInfo = await createStakePool(program.programId, manager, staker);

    [stakerAuthorityPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("staker")],
      program.programId
    );

    // hand the pool's staker authority to the program PDA
    const setStakerIx = new TransactionInstruction({
      programId: STAKE_POOL_PROGRAM_ID,
      keys: [
        { pubkey: stakePoolInfo.accounts.stakePoolAccount, isSigner: false, isWritable: true },
        { pubkey: manager.publicKey, isSigner: true, isWritable: false },
        { pubkey: stakerAuthorityPDA, isSigner: false, isWritable: false },
      ],
      data: Buffer.from(Uint8Array.of(13)), // SetStaker
    });
    await provider.sendAndConfirm(new Transaction().add(setStakerIx), [manager]);

    validatorStakeAccount = findValidatorStakeAccount(
      validatorVoteAccount,
      stakePoolInfo.accounts.stakePoolAccount
    );

    await program.methods
      .addValidator(0)
      .accounts({
        stakePool: stakePoolInfo.accounts.stakePoolAccount,
        reserveStake: stakePoolInfo.accounts.reserveStakeAccount,
        withdrawAuthority: stakePoolInfo.accounts.withdrawAuthorityAccount,
        validatorList: stakePoolInfo.accounts.validatorListAccount,
        validatorStakeAccount,
        validatorVoteAccount,
      })
      .signers([owner.payer])
      .rpc();

    // whitelist the user and fund the reserve with a plain deposit
    await addUserToWhitelist(program, user.publicKey);

    userPoolTokenATA = await getAssociatedTokenAddress(
      stakePoolInfo.accounts.poolMintAccount,
      user.publicKey
    );
    await provider.sendAndConfirm(
      new anchor.web3.Transaction().add(
        createAssociatedTokenAccountInstruction(
          user.publicKey,
          userPoolTokenATA,
          user.publicKey,
          stakePoolInfo.accounts.poolMintAccount
        )
      ),
      [user]
    );

    await program.methods
      .deposit(new BN(10 * LAMPORTS_PER_SOL))
      .accounts({
        user: user.publicKey,
        stakePool: stakePoolInfo.accounts.stakePoolAccount,
        depositAuthority: stakePoolInfo.accounts.depositAuthorityAccount,
        withdrawAuthority: stakePoolInfo.accounts.withdrawAuthorityAccount,
        poolReserve: stakePoolInfo.accounts.reserveStakeAccount,
        userPoolTokenAccount: userPoolTokenATA,
        feeTokenAccount: stakePoolInfo.accounts.feesTokenAccount,
        poolMint: stakePoolInfo.accounts.poolMintAccount,
        referralFeeTokenAccount: stakePoolInfo.accounts.feesTokenAccount,
      })
      .signers([user])
      .rpc();
  });

  const pool = () => stakePoolInfo.accounts;
  const transientAt = (seed: number | BN) =>
    findTransientStakeAccount(validatorVoteAccount, pool().stakePoolAccount, seed);
  const validatorInfo = () =>
    getValidatorStakeInfo(connection, pool().validatorListAccount, validatorVoteAccount);

  // Accounts for increase/decreaseValidatorStake (identical set).
  const rebalanceAccounts = (transientSeed: number | BN, ephemeralSeed: BN) => ({
    signer: stakeManager.publicKey,
    validatorVoteAccount,
    stakePool: pool().stakePoolAccount,
    reserveStake: pool().reserveStakeAccount,
    withdrawAuthority: pool().withdrawAuthorityAccount,
    validatorList: pool().validatorListAccount,
    validatorStakeAccount,
    transientStakeAccount: transientAt(transientSeed),
    ephemeralStakeAccount: findEphemeralStakeAccount(pool().stakePoolAccount, ephemeralSeed),
  });

  // Accounts for depositToSpecificValidator.
  const depositAccounts = (transientSeed: number | BN, ephemeralSeed: BN) => ({
    user: user.publicKey,
    stakePool: pool().stakePoolAccount,
    depositAuthority: pool().depositAuthorityAccount,
    withdrawAuthority: pool().withdrawAuthorityAccount,
    poolReserve: pool().reserveStakeAccount,
    userPoolTokenAccount: userPoolTokenATA,
    feeTokenAccount: pool().feesTokenAccount,
    poolMint: pool().poolMintAccount,
    referralFeeTokenAccount: pool().feesTokenAccount,
    validatorList: pool().validatorListAccount,
    ephemeralStakeAccount: findEphemeralStakeAccount(pool().stakePoolAccount, ephemeralSeed),
    transientStakeAccount: transientAt(transientSeed),
    validatorStakeAccount,
    validatorVoteAccount,
  });

  // Transaction builders. Every call uses a fresh ephemeral seed, so only the transient seed
  // decides whether SPL accepts the instruction.
  const increaseTx = (amount: BN, transientSeed: number | BN) => {
    const ephemeralSeed = randomStakeSeed();
    return program.methods
      .increaseValidatorStake(amount, new BN(transientSeed), ephemeralSeed)
      .accounts(rebalanceAccounts(transientSeed, ephemeralSeed))
      .transaction();
  };
  const decreaseTx = (amount: BN, transientSeed: number | BN) => {
    const ephemeralSeed = randomStakeSeed();
    return program.methods
      .decreaseValidatorStake(amount, new BN(transientSeed), ephemeralSeed)
      .accounts(rebalanceAccounts(transientSeed, ephemeralSeed))
      .transaction();
  };
  const depositTx = (amount: BN, transientSeed: number | BN) => {
    const ephemeralSeed = randomStakeSeed();
    return program.methods
      .depositToSpecificValidator(amount, new BN(transientSeed), ephemeralSeed)
      .accounts(depositAccounts(transientSeed, ephemeralSeed))
      .transaction();
  };

  const ALREADY_IN_USE = "already in use"; // System Allocate on the refilled transient PDA
  const wrongSeedLog = (recorded: number | BN) =>
    `Transient stake already exists with seed ${new BN(recorded).toString()}, you must use that one`;

  // The Immunefi #94595 trigger. Once the transient at `seed` has matured, ONE permissionless
  // transaction signed only by the attacker merges it (UpdateValidatorListBalance, no_merge =
  // false) and refills the emptied PDA with the stake-account rent before the runtime discards it.
  async function mergeAndRefillTransient(seed: number | BN): Promise<PublicKey> {
    const transient = transientAt(seed);
    const tx = new Transaction().add(
      buildUpdateValidatorListBalanceIx(
        validatorVoteAccount,
        pool().stakePoolAccount,
        pool().withdrawAuthorityAccount,
        pool().validatorListAccount,
        pool().reserveStakeAccount,
        seed
      ),
      SystemProgram.transfer({
        fromPubkey: attacker.publicKey,
        toPubkey: transient,
        lamports: stakeRent,
      })
    );
    await sendAndConfirmTransaction(connection, tx, [attacker], {
      commitment: "confirmed",
      preflightCommitment: "confirmed",
    });

    // the list no longer references any transient, but the stake-owned account survived
    const info = await validatorInfo();
    assert.isFalse(hasTransientStake(info), "the merge must zero the recorded transient stake");
    assert.equal(
      recordedTransientStakeSeed(info).toString(),
      new BN(seed).toString(),
      "a merge does not bump the recorded transient seed"
    );
    const refilled = await connection.getAccountInfo(transient);
    assert.ok(refilled, "the refilled transient PDA must survive the merge transaction");
    assert.isTrue(refilled.owner.equals(StakeProgram.programId), "still owned by the stake program");
    assert.equal(refilled.data.length, StakeProgram.space, "still holds stake-account data");
    assert.equal(refilled.lamports, stakeRent);
    return transient;
  }

  // The bot's second maintenance instruction. After the attacker's UpdateValidatorListBalance the
  // pool itself must still be marked current for this epoch before SPL accepts any increase or
  // decrease, so the attack does not get in the way of regular maintenance.
  const updatePoolBalance = () =>
    updatePoolStakeBalance(
      pool().stakePoolAccount,
      pool().withdrawAuthorityAccount,
      pool().validatorListAccount,
      pool().reserveStakeAccount,
      pool().poolMintAccount,
      pool().feesTokenAccount
    );

  it("increase_validator_stake: a refilled seed-0 transient blocks seed 0, the stake manager routes around it with a fresh seed", async () => {
    // a legitimate increase with the seed the program used to hardcode
    const firstAmount = new BN(2 * LAMPORTS_PER_SOL);
    await provider.sendAndConfirm(await increaseTx(firstAmount, 0), [stakeManager]);
    let info = await validatorInfo();
    assert.isTrue(recordedTransientStakeSeed(info).isZero());
    assert.equal(Number(info.transient_stake_lamports), firstAmount.toNumber() + stakeRent);

    // let the transient activate so maintenance will merge it
    await moveEpochForward(connection, 1);
    const validatorStakePre = await connection.getBalance(validatorStakeAccount);

    // the attack: merge + refill in one permissionless transaction
    const transient0 = await mergeAndRefillTransient(0);
    assert.equal(
      await connection.getBalance(validatorStakeAccount),
      validatorStakePre + firstAmount.toNumber(),
      "the merge itself is legitimate: the stake landed on the validator"
    );

    // regular maintenance still goes through; the pool is now current for this epoch
    await updatePoolBalance();

    // seed 0 is dead for good: SPL has to Allocate the refilled PDA
    await simulateExpectingLog(
      connection,
      await increaseTx(new BN(1 * LAMPORTS_PER_SOL), 0),
      owner.payer,
      [stakeManager],
      ALREADY_IN_USE,
      "increase with the refilled seed 0"
    );

    // THE FIX: the stake manager picks a fresh seed and the increase succeeds, no upgrade needed
    info = await validatorInfo();
    const freshSeed = transientStakeSeedFor(info);
    assert.isFalse(freshSeed.isZero(), "a fresh seed never repeats the merged one");
    const secondAmount = new BN(1 * LAMPORTS_PER_SOL);
    const sig = await provider.sendAndConfirm(await increaseTx(secondAmount, freshSeed), [
      stakeManager,
    ]);
    const event = await getEvent(program, sig, "validatorStakeIncreased");
    assert.ok(event, "increase with a fresh transient seed should emit the event");
    assert.strictEqual(event.data.validator.toBase58(), validatorVoteAccount.toBase58());
    assert.strictEqual(Number(event.data.amount), secondAmount.toNumber());

    info = await validatorInfo();
    assert.equal(recordedTransientStakeSeed(info).toString(), freshSeed.toString());
    assert.equal(Number(info.transient_stake_lamports), secondAmount.toNumber() + stakeRent);
    assert.equal(
      await connection.getBalance(transientAt(freshSeed)),
      secondAmount.toNumber() + stakeRent
    );

    // the poisoned address was routed around, not cleaned
    const stillThere = await connection.getAccountInfo(transient0);
    assert.ok(stillThere && stillThere.owner.equals(StakeProgram.programId));
  });

  it("deposit_to_specific_validator: a refilled transient blocks the recorded seed, a fresh seed routes around it", async () => {
    // let the transient from the previous test mature, then poison it
    await moveEpochForward(connection, 1);
    const before = await validatorInfo();
    assert.isTrue(hasTransientStake(before), "precondition: a transient is in flight");
    const recorded = recordedTransientStakeSeed(before);
    const poisoned = await mergeAndRefillTransient(recorded);
    await updatePoolBalance();

    const amount = new BN(1 * LAMPORTS_PER_SOL);
    await simulateExpectingLog(
      connection,
      await depositTx(amount, recorded),
      user,
      [],
      ALREADY_IN_USE,
      "deposit with the refilled recorded seed"
    );

    // the fix: a fresh seed, the user's funds move and receipts are minted
    const fresh = transientStakeSeedFor(await validatorInfo());
    assert.isFalse(fresh.eq(recorded), "a fresh seed never repeats the merged one");
    const userBalancePre = await connection.getBalance(user.publicKey);
    const sig = await provider.sendAndConfirm(await depositTx(amount, fresh), [user]);
    const event = await getEvent(program, sig, "depositedToSpecificValidator");
    assert.ok(event, "deposit with a fresh transient seed should emit the event");
    assert.strictEqual(event.data.validator.toBase58(), validatorVoteAccount.toBase58());
    assert.strictEqual(Number(event.data.amount), amount.toNumber());

    const info = await validatorInfo();
    assert.equal(recordedTransientStakeSeed(info).toString(), fresh.toString());
    assert.equal(Number(info.transient_stake_lamports), amount.toNumber() + stakeRent);
    assert.equal(
      await connection.getBalance(user.publicKey),
      userBalancePre - amount.toNumber() - stakeRent
    );

    const stillThere = await connection.getAccountInfo(poisoned);
    assert.ok(stillThere && stillThere.owner.equals(StakeProgram.programId));
  });

  it("decrease_validator_stake: a refilled transient blocks the recorded seed, a fresh seed routes around it", async () => {
    // let the transient from the previous test mature, then poison it
    await moveEpochForward(connection, 1);
    const before = await validatorInfo();
    assert.isTrue(hasTransientStake(before), "precondition: a transient is in flight");
    const recorded = recordedTransientStakeSeed(before);
    const poisoned = await mergeAndRefillTransient(recorded);
    await updatePoolBalance();

    const amount = new BN(1 * LAMPORTS_PER_SOL);
    await simulateExpectingLog(
      connection,
      await decreaseTx(amount, recorded),
      owner.payer,
      [stakeManager],
      ALREADY_IN_USE,
      "decrease with the refilled recorded seed"
    );

    // the fix: a fresh seed
    const fresh = transientStakeSeedFor(await validatorInfo());
    assert.isFalse(fresh.eq(recorded), "a fresh seed never repeats the merged one");
    const validatorStakePre = await connection.getBalance(validatorStakeAccount);
    const sig = await provider.sendAndConfirm(await decreaseTx(amount, fresh), [stakeManager]);
    const event = await getEvent(program, sig, "validatorStakeDecreased");
    assert.ok(event, "decrease with a fresh transient seed should emit the event");
    assert.strictEqual(event.data.validator.toBase58(), validatorVoteAccount.toBase58());
    assert.strictEqual(Number(event.data.amount), amount.toNumber());

    const info = await validatorInfo();
    assert.equal(recordedTransientStakeSeed(info).toString(), fresh.toString());
    assert.equal(Number(info.transient_stake_lamports), amount.toNumber() + stakeRent);
    assert.equal(
      await connection.getBalance(transientAt(fresh)),
      amount.toNumber() + stakeRent
    );
    assert.equal(
      await connection.getBalance(validatorStakeAccount),
      validatorStakePre - amount.toNumber()
    );

    // while that deactivating transient is in flight, any other seed is rejected before any merge
    await simulateExpectingLog(
      connection,
      await decreaseTx(amount, fresh.xor(new BN(1))),
      owner.payer,
      [stakeManager],
      wrongSeedLog(fresh),
      "decrease with a seed other than the recorded one"
    );

    const stillThere = await connection.getAccountInfo(poisoned);
    assert.ok(stillThere && stillThere.owner.equals(StakeProgram.programId));
  });

  it("while transient stake is in flight every path must use the recorded seed (SPL InvalidSeeds), and that seed merges into it", async () => {
    // start from a clean slate: maintenance merges the deactivating transient into the reserve,
    // and since nobody refilled it the PDA is discarded
    await moveEpochForwardAndUpdatePool(connection, pool(), validatorVoteAccount);
    let info = await validatorInfo();
    assert.isFalse(hasTransientStake(info));
    const merged = recordedTransientStakeSeed(info);
    assert.isNull(
      await connection.getAccountInfo(transientAt(merged)),
      "an un-refilled merge leaves nothing behind"
    );

    // put a new activating transient in flight at a fresh seed
    const live = transientStakeSeedFor(info);
    assert.isFalse(live.eq(merged), "a fresh seed never repeats the merged one");
    const amount = new BN(1 * LAMPORTS_PER_SOL);
    await provider.sendAndConfirm(await increaseTx(amount, live), [stakeManager]);
    info = await validatorInfo();
    assert.equal(recordedTransientStakeSeed(info).toString(), live.toString());
    assert.equal(Number(info.transient_stake_lamports), amount.toNumber() + stakeRent);

    // any other seed is rejected by SPL before anything moves, on all three paths
    const other = live.xor(new BN(1));
    await simulateExpectingLog(
      connection,
      await increaseTx(amount, other),
      owner.payer,
      [stakeManager],
      wrongSeedLog(live),
      "increase with a seed other than the recorded one"
    );
    await simulateExpectingLog(
      connection,
      await depositTx(amount, other),
      user,
      [],
      wrongSeedLog(live),
      "deposit with a seed other than the recorded one"
    );
    await simulateExpectingLog(
      connection,
      await decreaseTx(amount, other),
      owner.payer,
      [stakeManager],
      wrongSeedLog(live),
      "decrease with a seed other than the recorded one"
    );

    // the recorded seed is what clients must keep using while stake is in flight: a deposit with
    // it merges into the live transient
    assert.equal(transientStakeSeedFor(info).toString(), live.toString());
    const sig = await provider.sendAndConfirm(await depositTx(amount, live), [user]);
    assert.ok(await getEvent(program, sig, "depositedToSpecificValidator"));
    info = await validatorInfo();
    assert.equal(recordedTransientStakeSeed(info).toString(), live.toString());
    assert.equal(Number(info.transient_stake_lamports), 2 * (amount.toNumber() + stakeRent));
    assert.equal(
      await connection.getBalance(transientAt(live)),
      2 * (amount.toNumber() + stakeRent)
    );
  });

  it("remove_validator must be given the transient account recorded in the validator list, not seed 0", async () => {
    // merge the activating transient into the validator stake, then put a deactivating one in flight
    await moveEpochForwardAndUpdatePool(connection, pool(), validatorVoteAccount);
    let info = await validatorInfo();
    assert.isFalse(hasTransientStake(info));
    const live = transientStakeSeedFor(info);
    assert.isFalse(live.isZero());
    await provider.sendAndConfirm(await decreaseTx(new BN(1 * LAMPORTS_PER_SOL), live), [
      stakeManager,
    ]);
    info = await validatorInfo();
    assert.equal(recordedTransientStakeSeed(info).toString(), live.toString());
    assert.isTrue(hasTransientStake(info));

    const removeTx = (transientSeed: number | BN) =>
      program.methods
        .removeValidator()
        .accounts({
          stakePool: pool().stakePoolAccount,
          withdrawAuthority: pool().withdrawAuthorityAccount,
          validatorList: pool().validatorListAccount,
          validatorStakeAccount,
          transientStakeAccount: transientAt(transientSeed),
        })
        .transaction();

    // the old hardcoded seed-0 address no longer matches the list
    await simulateExpectingLog(
      connection,
      await removeTx(0),
      owner.payer,
      [],
      "Stake account address not properly derived from the validator address",
      "remove_validator with the seed-0 transient"
    );

    // the recorded one does, and the in-flight transient is deactivated along with the validator
    const sig = await provider.sendAndConfirm(await removeTx(live), []);
    const event = await getEvent(program, sig, "validatorRemoved");
    assert.ok(event, "remove_validator with the recorded transient should emit the event");
    assert.strictEqual(event.data.stakeAccount.toBase58(), validatorStakeAccount.toBase58());
  });
});
