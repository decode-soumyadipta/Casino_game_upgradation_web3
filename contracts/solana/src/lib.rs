// SPDX-License-Identifier: ISC
use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::{
    account_info::{next_account_info, AccountInfo},
    entrypoint,
    entrypoint::ProgramResult,
    msg,
    program_error::ProgramError,
    pubkey::Pubkey,
    rent::Rent,
    sysvar::Sysvar,
    program::invoke_signed,
    system_instruction,
};
use thiserror::Error;

// Program entry point
entrypoint!(process_instruction);

// Program ID
pub mod id {
    use solana_program::declare_id;
    declare_id!("CasinoGame1111111111111111111111111111111111");
}

// Client module for interacting with the program
pub mod client;

// Test modules
#[cfg(test)]
mod test;
#[cfg(test)]
mod security_test;
#[cfg(test)]
mod edge_cases_test;
#[cfg(test)]
mod tokio_tests;

// Error types
#[derive(Error, Debug, Copy, Clone)]
pub enum CasinoError {
    #[error("Invalid instruction")]
    InvalidInstruction,
    
    #[error("Not rent exempt")]
    NotRentExempt,
    
    #[error("Expected amount mismatch")]
    ExpectedAmountMismatch,
    
    #[error("Insufficient funds")]
    InsufficientFunds,
    
    #[error("Game already exists")]
    GameAlreadyExists,
    
    #[error("Game not found")]
    GameNotFound,
    
    #[error("Game already settled")]
    GameAlreadySettled,
    
    #[error("Unauthorized")]
    Unauthorized,
    
    #[error("Invalid bet amount")]
    InvalidBetAmount,
    
    #[error("Invalid house edge")]
    InvalidHouseEdge,
}

impl From<CasinoError> for ProgramError {
    fn from(e: CasinoError) -> Self {
        ProgramError::Custom(e as u32)
    }
}

// Instructions supported by the program
#[derive(BorshSerialize, BorshDeserialize, Clone, Debug, PartialEq)]
pub enum CasinoInstruction {
    /// Initialize the casino
    /// 
    /// Accounts expected:
    /// 0. `[signer, writable]` The authority account (casino owner)
    /// 1. `[writable]` The casino state account
    /// 2. `[]` System program
    Initialize {
        /// House edge in basis points (e.g., 250 = 2.5%)
        house_edge: u16,
        /// Minimum bet amount in lamports
        min_bet: u64,
        /// Maximum bet amount in lamports
        max_bet: u64,
    },
    
    /// Place a bet
    /// 
    /// Accounts expected:
    /// 0. `[signer, writable]` The player account
    /// 1. `[]` The casino state account
    /// 2. `[writable]` The game account
    /// 3. `[]` System program
    PlaceBet {
        /// Unique game ID
        game_id: [u8; 32],
        /// Bet amount in lamports
        bet_amount: u64,
    },
    
    /// Settle a game
    /// 
    /// Accounts expected:
    /// 0. `[signer]` The authority account (casino owner/operator)
    /// 1. `[]` The casino state account
    /// 2. `[writable]` The game account
    /// 3. `[writable]` The player account
    /// 4. `[]` System program
    SettleGame {
        /// Whether the player won
        is_win: bool,
        /// Win amount in lamports (0 if loss)
        win_amount: u64,
        /// Result hash for verification
        result_hash: [u8; 32],
    },
    
    /// Update casino parameters
    /// 
    /// Accounts expected:
    /// 0. `[signer]` The authority account (casino owner)
    /// 1. `[writable]` The casino state account
    UpdateParams {
        /// New house edge in basis points
        house_edge: Option<u16>,
        /// New minimum bet amount in lamports
        min_bet: Option<u64>,
        /// New maximum bet amount in lamports
        max_bet: Option<u64>,
    },
    
    /// Add an operator
    /// 
    /// Accounts expected:
    /// 0. `[signer]` The authority account (casino owner)
    /// 1. `[writable]` The casino state account
    /// 2. `[]` The operator account to add
    AddOperator,
    
    /// Remove an operator
    /// 
    /// Accounts expected:
    /// 0. `[signer]` The authority account (casino owner)
    /// 1. `[writable]` The casino state account
    /// 2. `[]` The operator account to remove
    RemoveOperator,
}

// Casino state
#[derive(BorshSerialize, BorshDeserialize, Debug)]
pub struct CasinoState {
    /// The owner of the casino
    pub authority: Pubkey,
    /// House edge in basis points (e.g., 250 = 2.5%)
    pub house_edge: u16,
    /// Minimum bet amount in lamports
    pub min_bet: u64,
    /// Maximum bet amount in lamports
    pub max_bet: u64,
    /// List of operator public keys
    pub operators: Vec<Pubkey>,
}

// Game state
#[derive(BorshSerialize, BorshDeserialize, Debug)]
pub struct GameState {
    /// The player who placed the bet
    pub player: Pubkey,
    /// Bet amount in lamports
    pub bet_amount: u64,
    /// Whether the game has been settled
    pub is_settled: bool,
    /// Whether the player won (only valid if is_settled is true)
    pub is_win: bool,
    /// Win amount in lamports (only valid if is_win is true)
    pub win_amount: u64,
    /// Result hash for verification
    pub result_hash: [u8; 32],
}

// Program entry point implementation
pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    // Deserialize instruction data
    let instruction = CasinoInstruction::try_from_slice(instruction_data)
        .map_err(|_| CasinoError::InvalidInstruction)?;
    
    match instruction {
        CasinoInstruction::Initialize { house_edge, min_bet, max_bet } => {
            process_initialize(program_id, accounts, house_edge, min_bet, max_bet)
        },
        CasinoInstruction::PlaceBet { game_id, bet_amount } => {
            process_place_bet(program_id, accounts, game_id, bet_amount)
        },
        CasinoInstruction::SettleGame { is_win, win_amount, result_hash } => {
            process_settle_game(program_id, accounts, is_win, win_amount, result_hash)
        },
        CasinoInstruction::UpdateParams { house_edge, min_bet, max_bet } => {
            process_update_params(program_id, accounts, house_edge, min_bet, max_bet)
        },
        CasinoInstruction::AddOperator => {
            process_add_operator(program_id, accounts)
        },
        CasinoInstruction::RemoveOperator => {
            process_remove_operator(program_id, accounts)
        },
    }
}

// Process Initialize instruction
fn process_initialize(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    house_edge: u16,
    min_bet: u64,
    max_bet: u64,
) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    
    // Get accounts
    let authority_info = next_account_info(account_info_iter)?;
    let casino_state_info = next_account_info(account_info_iter)?;
    let system_program_info = next_account_info(account_info_iter)?;
    
    // Check that the authority signed the transaction
    if !authority_info.is_signer {
        return Err(CasinoError::Unauthorized.into());
    }
    
    // Validate parameters
    if house_edge > 1000 {  // Max 10% house edge
        return Err(CasinoError::InvalidHouseEdge.into());
    }
    
    if min_bet > max_bet {
        return Err(CasinoError::InvalidBetAmount.into());
    }
    
    // Create casino state account
    let rent = Rent::get()?;
    let casino_state = CasinoState {
        authority: *authority_info.key,
        house_edge,
        min_bet,
        max_bet,
        operators: vec![*authority_info.key],  // Authority is an operator by default
    };
    
    let space = casino_state.try_to_vec()?.len();
    let lamports = rent.minimum_balance(space);
    
    // Derive the expected PDA
    let (expected_casino_state_pubkey, bump_seed) = Pubkey::find_program_address(
        &[b"casino", authority_info.key.as_ref()],
        program_id
    );
    
    // Verify the provided casino state account matches the expected PDA
    if expected_casino_state_pubkey != *casino_state_info.key {
        return Err(ProgramError::InvalidArgument);
    }
    
    // Create the account using PDA
    invoke_signed(
        &system_instruction::create_account(
            authority_info.key,
            casino_state_info.key,
            lamports,
            space as u64,
            program_id,
        ),
        &[
            authority_info.clone(),
            casino_state_info.clone(),
            system_program_info.clone(),
        ],
        &[&[b"casino", authority_info.key.as_ref(), &[bump_seed]]],
    )?;
    
    // Serialize the state into the newly created account
    casino_state.serialize(&mut *casino_state_info.data.borrow_mut())?;
    
    msg!("Casino initialized with house edge: {}, min bet: {}, max bet: {}", 
        house_edge, min_bet, max_bet);
    
    Ok(())
}

// Process PlaceBet instruction
fn process_place_bet(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    game_id: [u8; 32],
    bet_amount: u64,
) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    
    // Get accounts
    let player_info = next_account_info(account_info_iter)?;
    let casino_state_info = next_account_info(account_info_iter)?;
    let game_account_info = next_account_info(account_info_iter)?;
    let system_program_info = next_account_info(account_info_iter)?;
    
    // Check that the player signed the transaction
    if !player_info.is_signer {
        return Err(CasinoError::Unauthorized.into());
    }
    
    // Deserialize casino state
    let casino_state = CasinoState::try_from_slice(&casino_state_info.data.borrow())?;
    
    // Validate bet amount
    if bet_amount < casino_state.min_bet || bet_amount > casino_state.max_bet {
        return Err(CasinoError::InvalidBetAmount.into());
    }
    
    // Check if player has enough funds
    if player_info.lamports() < bet_amount {
        return Err(CasinoError::InsufficientFunds.into());
    }
    
    // Create game state
    let game_state = GameState {
        player: *player_info.key,
        bet_amount,
        is_settled: false,
        is_win: false,
        win_amount: 0,
        result_hash: [0; 32],
    };
    
    // Create game account
    let rent = Rent::get()?;
    let space = game_state.try_to_vec()?.len();
    let lamports = rent.minimum_balance(space);
    
    // Create the account with the game ID as seed
    let (game_pubkey, _) = Pubkey::find_program_address(
        &[&game_id],
        program_id,
    );
    
    // Verify the derived address matches the provided game account
    if game_pubkey != *game_account_info.key {
        return Err(ProgramError::InvalidArgument);
    }
    
    // Create the game account
    invoke_signed(
        &system_instruction::create_account(
            player_info.key,
            game_account_info.key,
            lamports,
            space as u64,
            program_id,
        ),
        &[
            player_info.clone(),
            game_account_info.clone(),
            system_program_info.clone(),
        ],
        &[&[&game_id]],
    )?;
    
    // Serialize the game state into the newly created account
    game_state.serialize(&mut *game_account_info.data.borrow_mut())?;
    
    // Transfer bet amount from player to the program
    **player_info.try_borrow_mut_lamports()? -= bet_amount;
    **game_account_info.try_borrow_mut_lamports()? += bet_amount;
    
    msg!("Bet placed: {} lamports", bet_amount);
    
    Ok(())
}

// Process SettleGame instruction
fn process_settle_game(
    _program_id: &Pubkey,
    accounts: &[AccountInfo],
    is_win: bool,
    win_amount: u64,
    result_hash: [u8; 32],
) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    
    let authority_info = next_account_info(account_info_iter)?;
    let casino_state_info = next_account_info(account_info_iter)?;
    let game_info = next_account_info(account_info_iter)?;
    let player_info = next_account_info(account_info_iter)?;
    let _system_program_info = next_account_info(account_info_iter)?;
    
    // Check that the authority signed the transaction
    if !authority_info.is_signer {
        return Err(CasinoError::Unauthorized.into());
    }
    
    // Deserialize casino state
    let casino_state = CasinoState::try_from_slice(&casino_state_info.data.borrow())?;
    
    // Check that the signer is an authorized operator
    if !casino_state.operators.contains(authority_info.key) {
        return Err(CasinoError::Unauthorized.into());
    }
    
    // Deserialize game state
    let mut game_state = GameState::try_from_slice(&game_info.data.borrow())?;
    
    // Check that the game has not been settled yet
    if game_state.is_settled {
        return Err(CasinoError::GameAlreadySettled.into());
    }
    
    // Check that the player account matches the one in the game state
    if *player_info.key != game_state.player {
        return Err(ProgramError::InvalidArgument);
    }
    
    // If the player won, validate the win amount against house edge
    if is_win {
        // Calculate maximum possible win with house edge
        let basis_points = 10000;
        let max_possible_win = game_state.bet_amount
            .checked_mul(basis_points)
            .ok_or(ProgramError::ArithmeticOverflow)?
            .checked_div(basis_points.checked_sub(casino_state.house_edge as u64).unwrap_or(1))
            .ok_or(ProgramError::ArithmeticOverflow)?;
        
        if win_amount > max_possible_win {
            return Err(CasinoError::ExpectedAmountMismatch.into());
        }
        
        // Transfer win amount to player
        **game_info.try_borrow_mut_lamports()? -= win_amount;
        **player_info.try_borrow_mut_lamports()? += win_amount;
    }
    
    // Update game state
    game_state.is_settled = true;
    game_state.is_win = is_win;
    game_state.win_amount = win_amount;
    game_state.result_hash = result_hash;
    
    // Serialize updated game state
    game_state.serialize(&mut *game_info.data.borrow_mut())?;
    
    msg!("Game settled: player {}, win amount: {}", 
        if is_win { "won" } else { "lost" }, 
        win_amount);
    
    Ok(())
}

// Process UpdateParams instruction
fn process_update_params(
    _program_id: &Pubkey,
    accounts: &[AccountInfo],
    house_edge: Option<u16>,
    min_bet: Option<u64>,
    max_bet: Option<u64>,
) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    
    // Get accounts
    let authority_info = next_account_info(account_info_iter)?;
    let casino_state_info = next_account_info(account_info_iter)?;
    
    // Check that the authority signed the transaction
    if !authority_info.is_signer {
        return Err(CasinoError::Unauthorized.into());
    }
    
    // Deserialize casino state
    let mut casino_state = CasinoState::try_from_slice(&casino_state_info.data.borrow())?;
    
    // Check that the signer is the casino authority
    if *authority_info.key != casino_state.authority {
        return Err(CasinoError::Unauthorized.into());
    }
    
    // Update parameters if provided
    if let Some(edge) = house_edge {
        if edge > 1000 {  // Max 10% house edge
            return Err(CasinoError::InvalidHouseEdge.into());
        }
        casino_state.house_edge = edge;
    }
    
    if let Some(min) = min_bet {
        casino_state.min_bet = min;
    }
    
    if let Some(max) = max_bet {
        casino_state.max_bet = max;
    }
    
    // Validate min/max bet relationship
    if casino_state.min_bet > casino_state.max_bet {
        return Err(CasinoError::InvalidBetAmount.into());
    }
    
    // Serialize updated casino state
    casino_state.serialize(&mut *casino_state_info.data.borrow_mut())?;
    
    msg!("Casino parameters updated: house edge: {}, min bet: {}, max bet: {}", 
        casino_state.house_edge, casino_state.min_bet, casino_state.max_bet);
    
    Ok(())
}

// Process AddOperator instruction
fn process_add_operator(
    _program_id: &Pubkey,
    accounts: &[AccountInfo],
) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    
    // Get accounts
    let authority_info = next_account_info(account_info_iter)?;
    let casino_state_info = next_account_info(account_info_iter)?;
    let operator_info = next_account_info(account_info_iter)?;
    
    // Check that the authority signed the transaction
    if !authority_info.is_signer {
        return Err(CasinoError::Unauthorized.into());
    }
    
    // Deserialize casino state
    let mut casino_state = CasinoState::try_from_slice(&casino_state_info.data.borrow())?;
    
    // Check that the signer is the casino authority
    if *authority_info.key != casino_state.authority {
        return Err(CasinoError::Unauthorized.into());
    }
    
    // Add operator if not already in the list
    if !casino_state.operators.contains(operator_info.key) {
        casino_state.operators.push(*operator_info.key);
        
        // Serialize updated casino state
        casino_state.serialize(&mut *casino_state_info.data.borrow_mut())?;
        
        msg!("Operator added: {}", operator_info.key);
    } else {
        msg!("Operator already exists: {}", operator_info.key);
    }
    
    Ok(())
}

// Process RemoveOperator instruction
fn process_remove_operator(
    _program_id: &Pubkey,
    accounts: &[AccountInfo],
) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    
    // Get accounts
    let authority_info = next_account_info(account_info_iter)?;
    let casino_state_info = next_account_info(account_info_iter)?;
    let operator_info = next_account_info(account_info_iter)?;
    
    // Check that the authority signed the transaction
    if !authority_info.is_signer {
        return Err(CasinoError::Unauthorized.into());
    }
    
    // Deserialize casino state
    let mut casino_state = CasinoState::try_from_slice(&casino_state_info.data.borrow())?;
    
    // Check that the signer is the casino authority
    if *authority_info.key != casino_state.authority {
        return Err(CasinoError::Unauthorized.into());
    }
    
    // Don't allow removing the authority as an operator
    if *operator_info.key == casino_state.authority {
        return Err(CasinoError::Unauthorized.into());
    }
    
    // Remove operator if in the list
    if let Some(index) = casino_state.operators.iter().position(|&x| x == *operator_info.key) {
        casino_state.operators.remove(index);
        
        // Serialize updated casino state
        casino_state.serialize(&mut *casino_state_info.data.borrow_mut())?;
        
        msg!("Operator removed: {}", operator_info.key);
    } else {
        msg!("Operator not found: {}", operator_info.key);
    }
    
    Ok(())
}

#[cfg(test)]
mod tests {
    use crate::*;
    use solana_program::pubkey::Pubkey;
    
    // Test the program ID
    #[test]
    fn test_program_id() {
        let program_id = id::id();
        assert_ne!(program_id, Pubkey::default());
    }
    
    // We'll skip the complex tests for now as they require a more elaborate setup
    // The basic test above ensures that our program ID is valid
} 