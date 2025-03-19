import { PublicKey } from "@solana/web3.js";
import { getStakePool } from "../tests/helpers";
import { getConnection, getStakePoolAccount } from "./utils";

// Get the Solana connection
const connection = getConnection();

// get config variables
const stake_pool_account = new PublicKey(getStakePoolAccount());

// A script to fetch the stake pool info
// usage: yarn fetch-stake-pool
async function main() {
    const stakePool = await getStakePool(connection, stake_pool_account);

    const reserveBalance = await connection.getBalance(stakePool.reserveStake);

    console.log("stake pool account:", stake_pool_account.toBase58());
    console.log("manager:", stakePool.manager.toBase58());
    console.log("staker:", stakePool.staker.toBase58());
    console.log("stake deposit authority:", stakePool.stakeDepositAuthority.toBase58());
    console.log("SOL deposit authority:", stakePool.solDepositAuthority.toBase58());
    console.log("SOL withdraw authority:", stakePool.solWithdrawAuthority.toBase58());
    console.log("validator list:", stakePool.validatorList.toBase58());
    console.log("reserve stake:", stakePool.reserveStake.toBase58());
    console.log("TruSOL token mint:", stakePool.poolMint.toBase58());
    console.log("manager fee account:", stakePool.managerFeeAccount.toBase58());
    console.log("token program id:", stakePool.tokenProgramId.toBase58());
    console.log("last update epoch:", Number(stakePool.lastUpdateEpoch));
    console.log("epoch fee:", Number(stakePool.epochFee.numerator), "/", Number(stakePool.epochFee.denominator));
    console.log("SOL deposit fee:", Number(stakePool.solDepositFee.numerator), "/", Number(stakePool.solDepositFee.denominator));
    console.log("stake deposit fee:", Number(stakePool.stakeDepositFee.numerator), "/", Number(stakePool.stakeDepositFee.denominator));
    console.log("stake withdrawal fee:", Number(stakePool.stakeWithdrawalFee.numerator), "/", Number(stakePool.stakeWithdrawalFee.denominator));
    console.log("SOL withdrawal fee:", Number(stakePool.solWithdrawalFee.numerator), "/", Number(stakePool.solWithdrawalFee.denominator));
    console.log("total stake:", Number(stakePool.totalLamports), `(${ Number(stakePool.totalLamports) / 1e9 } SOL)`);
    console.log("TruSOL supply:", Number(stakePool.poolTokenSupply), `(${ Number(stakePool.poolTokenSupply) / 1e9 } TruSOL)`);
    console.log("reserve balance:", Number(reserveBalance), `(${ Number(reserveBalance) / 1e9 } SOL)`);
    console.log("share price:", Number(stakePool.totalLamports) / Number(stakePool.poolTokenSupply));
}

main().catch((error) => {
    console.error("Unexpected error:", error);
    process.exit(1);
});
