import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import { decodeValidatorListAccount, getStakePool, stakeStatusToString } from "../tests/helpers";
import { getConnection, getStakePoolAccount, getStakePoolProgramId } from "./utils";

// Get the Solana connection
const connection = getConnection();

// get config variables
const stake_pool_account = new PublicKey(getStakePoolAccount());
const stake_pool_program_id = new PublicKey(getStakePoolProgramId());

// A script to fetch the list of validators in the stake pool
// usage: yarn fetch-validators
async function main() {
    const stakePool = await getStakePool(connection, stake_pool_account);
    const validatorList = await decodeValidatorListAccount(connection, stakePool.validatorList);
    console.log("max_validators:", validatorList.header.max_validators);

    validatorList.validators.forEach((validator, idx) => {

        // if seed is 0 it means the validator is not using a seed
        const validator_seed_suffix = validator.validator_seed_suffix;
        const validatorStakeAccountSeeds = (validator_seed_suffix === 0)?
            [
                validator.vote_account_address.toBuffer(),
                stake_pool_account.toBuffer(),
            ]
            :
            [
                validator.vote_account_address.toBuffer(),
                stake_pool_account.toBuffer(),
                new BN(validator_seed_suffix).toArrayLike(Buffer, "le", 8),
            ]

        const [validatorStakeAccount] = PublicKey.findProgramAddressSync(validatorStakeAccountSeeds, stake_pool_program_id);

        const transient_seed_suffix = validator.transient_seed_suffix;
        const [transientStakeAccount] = PublicKey.findProgramAddressSync(
            [
                Buffer.from("transient"),
                validator.vote_account_address.toBuffer(),
                stake_pool_account.toBuffer(),
                new BN(Number(transient_seed_suffix)).toArrayLike(Buffer, "le", 8),
            ],
            stake_pool_program_id
        );

        console.log(`Validator ${idx}: ${validator.vote_account_address.toBase58()}`);
        console.log(
            "  Stake Account:\t", validatorStakeAccount.toBase58(), 
            "Active balance:\t", `${Number(validator.active_stake_lamports) / LAMPORTS_PER_SOL} SOL`
        );
        console.log(
            "  Transient Account:\t", transientStakeAccount.toBase58(),
            "Transient balance:",`${Number(validator.transient_stake_lamports) / LAMPORTS_PER_SOL} SOL`
        );
        console.log("  Last update epoch:", validator.last_update_epoch.toString());
        console.log("  Stake status:", stakeStatusToString(validator.status));
    });
}


// Run the main function
main().catch((error) => {
    console.error("Unexpected error:", error);
    process.exit(1);
});
