use crate::error::ErrorCode;
use crate::{state::*, ANCHOR_DISCRIMINATOR};
use anchor_lang::prelude::*;

#[derive(Accounts)]
#[event_cpi]
pub struct Pause<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        mut,
        has_one = owner @ ErrorCode::NotAuthorized,
        constraint = !access.is_paused @ ErrorCode::ContractPaused,
        seeds = [b"access"],
        bump
    )]
    pub access: Account<'info, Access>,
}

/// Processes the `Pause` instruction
pub fn process_pause(ctx: Context<Pause>) -> Result<()> {
    let access = &mut ctx.accounts.access;
    access.is_paused = true;
    emit_cpi! {StakerPaused {}};
    Ok(())
}

#[derive(Accounts)]
#[event_cpi]
pub struct Unpause<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        mut,
        has_one = owner @ ErrorCode::NotAuthorized,
        constraint = access.is_paused @ ErrorCode::NotPaused,
        seeds = [b"access"],
        bump
    )]
    pub access: Account<'info, Access>,
}

/// Processes the `Unpause` instruction
pub fn process_unpause(ctx: Context<Unpause>) -> Result<()> {
    let access = &mut ctx.accounts.access;
    access.is_paused = false;
    emit_cpi! {StakerUnpaused {}};
    Ok(())
}

#[derive(Accounts)]
#[event_cpi]
pub struct SetStakerPendingOwner<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        mut,
        has_one = owner @ ErrorCode::NotAuthorized,
        seeds = [b"access"],
        bump
    )]
    pub access: Account<'info, Access>,
}

/// Processes the `SetStakerPendingOwner` instruction
pub fn process_set_pending_owner(
    ctx: Context<SetStakerPendingOwner>,
    pending_owner: Pubkey,
) -> Result<()> {
    let access_account = &mut ctx.accounts.access;
    access_account.pending_owner = Some(pending_owner);
    emit_cpi! {SetPendingOwner {
        current_owner: access_account.owner,
        pending_owner,
    }};
    Ok(())
}

#[derive(Accounts)]
#[event_cpi]
pub struct StakerClaimOwnership<'info> {
    #[account(mut)]
    pub pending_owner: Signer<'info>,

    #[account(
        mut,
        constraint = access.pending_owner.is_some() @ ErrorCode::PendingOwnerNotSet,
        constraint = access.pending_owner.unwrap() == pending_owner.key() @ ErrorCode::NotPendingOwner,
        seeds = [b"access"],
        bump
    )]
    pub access: Account<'info, Access>,
}

/// Processes the `ClaimOwnership` instruction
pub fn process_claim_ownership(ctx: Context<StakerClaimOwnership>) -> Result<()> {
    let access_account = &mut ctx.accounts.access;
    let old_owner = access_account.owner;
    access_account.owner = access_account.pending_owner.unwrap();
    access_account.pending_owner = None;
    emit_cpi! {ClaimedOwnership {
        old_owner,
        new_owner: access_account.owner,
    }};
    Ok(())
}

#[derive(Accounts)]
#[event_cpi]
pub struct SetStakeManager<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        mut,
        has_one = owner @ ErrorCode::NotAuthorized,
        seeds = [b"access"],
        bump
    )]
    pub access: Account<'info, Access>,

    #[account(
        init,
        payer = owner,
        space = ANCHOR_DISCRIMINATOR + StakeManager::INIT_SPACE,
        seeds = [b"stake_manager", new_stake_manager.key().as_ref()],
        bump
    )]
    pub new_stake_manager_pda: Account<'info, StakeManager>,

    /// CHECK: New staker manager authority
    #[account()]
    pub new_stake_manager: AccountInfo<'info>,

    #[account(
        mut,
        seeds = [b"stake_manager", old_stake_manager.key().as_ref()],
        bump,
        close = owner
    )]
    pub old_stake_manager_pda: Account<'info, StakeManager>,

    /// CHECK: Old staker manager authority
    #[account()]
    pub old_stake_manager: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

/// Processes the `SetStakeManager` instruction
pub fn process_set_stake_manager(ctx: Context<SetStakeManager>) -> Result<()> {
    let access = &mut ctx.accounts.access;
    access.stake_manager = ctx.accounts.new_stake_manager.key();
    emit_cpi! {StakeManagerSet {
        old_stake_manager: ctx.accounts.old_stake_manager.key(),
        new_stake_manager: ctx.accounts.new_stake_manager.key(),
    }};
    Ok(())
}
