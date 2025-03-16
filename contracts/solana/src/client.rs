// SPDX-License-Identifier: ISC
use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::{
    instruction::{AccountMeta, Instruction},
    pubkey::Pubkey,
    system_program,
};

use crate::{id, CasinoInstruction};

/// Creates an instruction to initialize the casino
pub fn initialize(
    authority: &Pubkey,
    casino_state: &Pubkey,
    house_edge: u16,
    min_bet: u64,
    max_bet: u64,
) -> Instruction {
    let data = CasinoInstruction::Initialize {
        house_edge,
        min_bet,
        max_bet,
    }
    .try_to_vec()
    .unwrap();

    Instruction {
        program_id: id::id(),
        accounts: vec![
            AccountMeta::new(*authority, true),
            AccountMeta::new(*casino_state, false),
            AccountMeta::new_readonly(system_program::id(), false),
        ],
        data,
    }
}

/// Creates an instruction to place a bet
pub fn place_bet(
    player: &Pubkey,
    casino_state: &Pubkey,
    game_account: &Pubkey,
    game_id: [u8; 32],
    bet_amount: u64,
) -> Instruction {
    let data = CasinoInstruction::PlaceBet {
        game_id,
        bet_amount,
    }
    .try_to_vec()
    .unwrap();

    Instruction {
        program_id: id::id(),
        accounts: vec![
            AccountMeta::new(*player, true),
            AccountMeta::new_readonly(*casino_state, false),
            AccountMeta::new(*game_account, false),
            AccountMeta::new_readonly(system_program::id(), false),
        ],
        data,
    }
}

/// Creates an instruction to settle a game
pub fn settle_game(
    authority: &Pubkey,
    casino_state: &Pubkey,
    game_account: &Pubkey,
    player: &Pubkey,
    is_win: bool,
    win_amount: u64,
    result_hash: [u8; 32],
) -> Instruction {
    let data = CasinoInstruction::SettleGame {
        is_win,
        win_amount,
        result_hash,
    }
    .try_to_vec()
    .unwrap();

    Instruction {
        program_id: id::id(),
        accounts: vec![
            AccountMeta::new(*authority, true),
            AccountMeta::new_readonly(*casino_state, false),
            AccountMeta::new(*game_account, false),
            AccountMeta::new(*player, false),
            AccountMeta::new_readonly(system_program::id(), false),
        ],
        data,
    }
}

/// Creates an instruction to update casino parameters
pub fn update_params(
    authority: &Pubkey,
    casino_state: &Pubkey,
    house_edge: Option<u16>,
    min_bet: Option<u64>,
    max_bet: Option<u64>,
) -> Instruction {
    let data = CasinoInstruction::UpdateParams {
        house_edge,
        min_bet,
        max_bet,
    }
    .try_to_vec()
    .unwrap();

    Instruction {
        program_id: id::id(),
        accounts: vec![
            AccountMeta::new(*authority, true),
            AccountMeta::new(*casino_state, false),
        ],
        data,
    }
}

/// Creates an instruction to add an operator
pub fn add_operator(
    authority: &Pubkey,
    casino_state: &Pubkey,
    operator: &Pubkey,
) -> Instruction {
    let data = CasinoInstruction::AddOperator.try_to_vec().unwrap();

    Instruction {
        program_id: id::id(),
        accounts: vec![
            AccountMeta::new(*authority, true),
            AccountMeta::new(*casino_state, false),
            AccountMeta::new_readonly(*operator, false),
        ],
        data,
    }
}

/// Creates an instruction to remove an operator
pub fn remove_operator(
    authority: &Pubkey,
    casino_state: &Pubkey,
    operator: &Pubkey,
) -> Instruction {
    let data = CasinoInstruction::RemoveOperator.try_to_vec().unwrap();

    Instruction {
        program_id: id::id(),
        accounts: vec![
            AccountMeta::new(*authority, true),
            AccountMeta::new(*casino_state, false),
            AccountMeta::new_readonly(*operator, false),
        ],
        data,
    }
}

/// Finds the program-derived address for a casino state account
pub fn find_casino_state_address(authority: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[b"casino", authority.as_ref()], &id::id())
}

/// Finds the program-derived address for a game account
pub fn find_game_address(game_id: &[u8; 32]) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[game_id], &id::id())
} 