pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
use solana_security_txt::security_txt;
pub use state::*;

declare_id!("6EZAJVrNQdnBJU6ULxXSDaEoK6fN7C3iXTCkZKRWDdGM");

#[cfg(not(feature = "no-entrypoint"))]
security_txt! {
    name: "Trufin Liquid Staking Program",
    project_url: "https://trufin.io",
    contacts: "email:security@trufinlabs.com.",
    policy: "https://immunefi.com/bug-bounty/trufin/information/#top",
    preferred_languages: "en",
    source_code: "https://github.com/TruFin-io/solana-smart-contracts"
}

#[program]
pub mod staker {
    use super::*;

    pub fn initialize_staker(ctx: Context<InitializeStaker>) -> Result<()> {
        initialize::process_initialize_staker(ctx)
    }

    pub fn pause(ctx: Context<Pause>) -> Result<()> {
        setters::process_pause(ctx)
    }

    pub fn unpause(ctx: Context<Unpause>) -> Result<()> {
        setters::process_unpause(ctx)
    }

    pub fn set_pending_owner(
        ctx: Context<SetStakerPendingOwner>,
        pending_owner: Pubkey,
    ) -> Result<()> {
        setters::process_set_pending_owner(ctx, pending_owner)
    }

    pub fn claim_ownership(ctx: Context<StakerClaimOwnership>) -> Result<()> {
        setters::process_claim_ownership(ctx)
    }

    pub fn set_stake_manager(ctx: Context<SetStakeManager>) -> Result<()> {
        setters::process_set_stake_manager(ctx)
    }

    pub fn add_agent(ctx: Context<AddAgent>, agent: Pubkey) -> Result<()> {
        whitelist::process_add_agent(ctx, agent)
    }

    pub fn remove_agent(ctx: Context<RemoveAgent>, agent: Pubkey) -> Result<()> {
        whitelist::process_remove_agent(ctx, agent)
    }

    pub fn add_user_to_whitelist(ctx: Context<AddUserToWhitelist>, user: Pubkey) -> Result<()> {
        whitelist::process_add_user_to_whitelist(ctx, user)
    }

    pub fn add_user_to_blacklist(ctx: Context<AddUserToBlacklist>, user: Pubkey) -> Result<()> {
        whitelist::process_add_user_to_blacklist(ctx, user)
    }

    pub fn clear_user_status(ctx: Context<ClearUserStatus>, user: Pubkey) -> Result<()> {
        whitelist::process_clear_user_status(ctx, user)
    }

    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        staking::process_deposit(ctx, amount)
    }

    pub fn deposit_to_specific_validator(
        ctx: Context<DepositToSpecificValidator>,
        amount: u64,
    ) -> Result<()> {
        staking::process_deposit_to_specific_validator(ctx, amount, 0, 0)
    }

    pub fn add_validator(ctx: Context<AddValidator>, validator_seed: u32) -> Result<()> {
        validators::process_add_validator(ctx, validator_seed)
    }

    pub fn remove_validator(ctx: Context<RemoveValidator>) -> Result<()> {
        validators::process_remove_validator(ctx)
    }

    pub fn increase_validator_stake(
        ctx: Context<IncreaseValidatorStake>,
        amount: u64,
    ) -> Result<()> {
        validators::process_increase_validator_stake(ctx, amount, 0, 0)
    }

    pub fn decrease_validator_stake(
        ctx: Context<DecreaseValidatorStake>,
        amount: u64,
    ) -> Result<()> {
        validators::process_decrease_validator_stake(ctx, amount, 0, 0)
    }
}
