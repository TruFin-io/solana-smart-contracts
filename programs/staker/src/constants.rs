use anchor_lang::prelude::Pubkey;

// Stake Pool program ID (SPoo1Ku8WFXoNDMHPsrGSTSG1Y47rzgn41SLUNakuHy)
pub const STAKE_POOL_PROGRAM_ID: Pubkey = Pubkey::new_from_array([
    6, 129, 78, 212, 202, 246, 138, 23, 70, 114, 253, 172, 134, 3, 26, 99, 232, 78, 161, 94, 250,
    29, 68, 183, 34, 147, 246, 219, 219, 0, 22, 80,
]);

pub const ANCHOR_DISCRIMINATOR: usize = 8;

pub const ONE_SOL: u64 = 1_000_000_000; // 1 SOL in lamports
