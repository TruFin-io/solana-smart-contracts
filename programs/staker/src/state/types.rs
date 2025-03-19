use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct Access {
    pub owner: Pubkey,
    pub stake_manager: Pubkey,
    pub is_paused: bool,
    pub pending_owner: Option<Pubkey>,
}

#[account]
#[derive(InitSpace)]
pub struct Agent {}

#[account]
#[derive(InitSpace)]
pub struct UserStatus {
    pub status: WhitelistUserStatus,
}

#[derive(AnchorSerialize, AnchorDeserialize, Debug, Clone, InitSpace, PartialEq, Eq)]
pub enum WhitelistUserStatus {
    None,
    Whitelisted,
    Blacklisted,
}

#[account]
#[derive(InitSpace)]
pub struct StakeManager {}
