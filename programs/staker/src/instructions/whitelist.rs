use crate::{error::ErrorCode, state::*, ANCHOR_DISCRIMINATOR};
use anchor_lang::prelude::*;

#[derive(Accounts)]
#[event_cpi]
#[instruction(agent: Pubkey)]
pub struct AddAgent<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(
        init,
        payer = signer,
        space = ANCHOR_DISCRIMINATOR + Agent::INIT_SPACE,
        seeds = [b"agent", agent.as_ref()],
        bump
    )]
    pub new_agent_account: Account<'info, Agent>,

    #[account(
        seeds = [b"agent", signer.key().as_ref()],
        bump
    )]
    pub agent_account: Account<'info, Agent>,

    pub system_program: Program<'info, System>,
}

/// Processes the `AddAgent` instruction
pub fn process_add_agent(ctx: Context<AddAgent>, agent: Pubkey) -> Result<()> {
    emit_cpi! {
        AgentAdded {
            new_agent: agent
        }
    };

    Ok(())
}

#[derive(Accounts)]
#[event_cpi]
#[instruction(agent: Pubkey)]
pub struct RemoveAgent<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(
        mut,
        constraint = agent != access.owner.key() @ ErrorCode::CannotRemoveOwner,
        seeds = [b"agent", agent.as_ref()],
        bump,
        close = signer
    )]
    pub agent_account_to_remove: Account<'info, Agent>,

    #[account(
        seeds = [b"agent", signer.key().as_ref()],
        bump
    )]
    pub agent_account: Account<'info, Agent>,

    pub system_program: Program<'info, System>,

    #[account(
        seeds = [b"access"],
        bump
    )]
    pub access: Account<'info, Access>,
}

/// Processes the `RemoveAgent` instruction
pub fn process_remove_agent(ctx: Context<RemoveAgent>, agent: Pubkey) -> Result<()> {
    emit_cpi! {
        AgentRemoved {
            removed_agent: agent
        }
    };

    Ok(())
}

#[derive(Accounts)]
#[event_cpi]
#[instruction(user: Pubkey)]
pub struct AddUserToWhitelist<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(
        init_if_needed,
        constraint = user_whitelist_account.status != WhitelistUserStatus::Whitelisted @ ErrorCode::AlreadyWhitelisted,
        payer = signer,
        space = ANCHOR_DISCRIMINATOR + UserStatus::INIT_SPACE,
        seeds = [b"user", user.as_ref()],
        bump
    )]
    pub user_whitelist_account: Account<'info, UserStatus>,

    #[account(
        seeds = [b"agent", signer.key().as_ref()],
        bump
    )]
    pub agent_account: Account<'info, Agent>,

    pub system_program: Program<'info, System>,
}

/// Processes the `AddUserToWhitelist` instruction
pub fn process_add_user_to_whitelist(ctx: Context<AddUserToWhitelist>, user: Pubkey) -> Result<()> {
    let user_status = &mut ctx.accounts.user_whitelist_account;
    let old_status = user_status.status.clone();
    user_status.status = WhitelistUserStatus::Whitelisted;
    emit_cpi! {
        WhitelistingStatusChanged {
            user,
            old_status,
            new_status: WhitelistUserStatus::Whitelisted
        }
    };
    Ok(())
}

#[derive(Accounts)]
#[event_cpi]
#[instruction(user: Pubkey)]
pub struct AddUserToBlacklist<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(
        init_if_needed,
        constraint = user_whitelist_account.status != WhitelistUserStatus::Blacklisted @ ErrorCode::AlreadyBlacklisted,
        payer = signer,
        space = ANCHOR_DISCRIMINATOR + UserStatus::INIT_SPACE,
        seeds = [b"user", user.as_ref()],
        bump
    )]
    pub user_whitelist_account: Account<'info, UserStatus>,

    #[account(
        seeds = [b"agent", signer.key().as_ref()],
        bump
    )]
    pub agent_account: Account<'info, Agent>,

    pub system_program: Program<'info, System>,
}

/// Processes the `AddUserToBlacklist` instruction
pub fn process_add_user_to_blacklist(ctx: Context<AddUserToBlacklist>, user: Pubkey) -> Result<()> {
    let user_status = &mut ctx.accounts.user_whitelist_account;
    let old_status = user_status.status.clone();
    user_status.status = WhitelistUserStatus::Blacklisted;
    emit_cpi! {
        WhitelistingStatusChanged {
            user,
            old_status,
            new_status: WhitelistUserStatus::Blacklisted
        }
    };
    Ok(())
}

#[derive(Accounts)]
#[event_cpi]
#[instruction(user: Pubkey)]
pub struct ClearUserStatus<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(
        init_if_needed,
        constraint = user_whitelist_account.status != WhitelistUserStatus::None @ ErrorCode::AlreadyCleared,
        payer = signer,
        space = ANCHOR_DISCRIMINATOR + UserStatus::INIT_SPACE,
        seeds = [b"user", user.as_ref()],
        bump
    )]
    pub user_whitelist_account: Account<'info, UserStatus>,

    #[account(
        seeds = [b"agent", signer.key().as_ref()],
        bump
    )]
    pub agent_account: Account<'info, Agent>,

    pub system_program: Program<'info, System>,
}

/// Processes the `ClearUserStatus` instruction
pub fn process_clear_user_status(ctx: Context<ClearUserStatus>, user: Pubkey) -> Result<()> {
    let user_status = &mut ctx.accounts.user_whitelist_account;
    let old_status = user_status.status.clone();
    user_status.status = WhitelistUserStatus::None;
    emit_cpi! {
        WhitelistingStatusChanged {
            user,
            old_status,
            new_status: WhitelistUserStatus::None
        }
    };
    Ok(())
}
