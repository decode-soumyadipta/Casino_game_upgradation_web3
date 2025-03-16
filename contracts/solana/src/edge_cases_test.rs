#[cfg(test)]
mod edge_cases_tests {
    use {
        crate::{id, CasinoState, GameState, process_instruction},
        borsh::BorshDeserialize,
        solana_program::{
            instruction::{AccountMeta, Instruction},
            program_error::ProgramError,
            pubkey::Pubkey,
            rent::Rent,
            system_instruction,
        },
        solana_program_test::*,
        solana_sdk::{
            account::Account,
            signature::{Keypair, Signer},
            transaction::{Transaction, TransactionError},
        },
    };

    // Helper function to create a program test environment
    fn program_test() -> ProgramTest {
        let mut program_test = ProgramTest::new(
            "casino_game",
            id::id(),
            processor!(process_instruction),
        );
        program_test
    }

    #[tokio::test]
    async fn test_zero_bet_amount() {
        let mut program_test = program_test();
        
        // Create test accounts
        let authority = Keypair::new();
        let player = Keypair::new();
        
        // Find PDAs
        let (casino_state_pubkey, _) = Pubkey::find_program_address(
            &[b"casino", authority.pubkey().as_ref()],
            &id::id(),
        );
        
        let game_id = [1u8; 32];
        let (game_pubkey, _) = Pubkey::find_program_address(
            &[&game_id],
            &id::id(),
        );
        
        // Fund the accounts
        program_test.add_account(
            authority.pubkey(),
            Account {
                lamports: 1_000_000_000,
                ..Account::default()
            },
        );
        
        program_test.add_account(
            player.pubkey(),
            Account {
                lamports: 1_000_000_000,
                ..Account::default()
            },
        );
        
        // Start the program test
        let (mut banks_client, payer, recent_blockhash) = program_test.start().await;
        
        // Initialize the casino
        let house_edge = 250; // 2.5%
        let min_bet = 100_000; // 0.0001 SOL
        let max_bet = 1_000_000_000; // 1 SOL
        
        let init_instruction = crate::client::initialize(
            &authority.pubkey(),
            &casino_state_pubkey,
            house_edge,
            min_bet,
            max_bet,
        );
        
        let mut init_transaction = Transaction::new_with_payer(
            &[init_instruction],
            Some(&payer.pubkey()),
        );
        init_transaction.sign(&[&payer, &authority], recent_blockhash);
        
        banks_client.process_transaction(init_transaction).await.unwrap();
        
        // Try to place a bet with zero amount
        let zero_bet = 0;
        
        let zero_bet_instruction = crate::client::place_bet(
            &player.pubkey(),
            &casino_state_pubkey,
            &game_pubkey,
            game_id,
            zero_bet,
        );
        
        let mut zero_bet_transaction = Transaction::new_with_payer(
            &[zero_bet_instruction],
            Some(&payer.pubkey()),
        );
        zero_bet_transaction.sign(&[&payer, &player], recent_blockhash);
        
        // This should fail because bet amount is zero
        let result = banks_client.process_transaction(zero_bet_transaction).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_max_win_amount_calculation() {
        let mut program_test = program_test();
        
        // Create test accounts
        let authority = Keypair::new();
        let player = Keypair::new();
        
        // Find PDAs
        let (casino_state_pubkey, _) = Pubkey::find_program_address(
            &[b"casino", authority.pubkey().as_ref()],
            &id::id(),
        );
        
        let game_id = [1u8; 32];
        let (game_pubkey, _) = Pubkey::find_program_address(
            &[&game_id],
            &id::id(),
        );
        
        // Fund the accounts
        program_test.add_account(
            authority.pubkey(),
            Account {
                lamports: 1_000_000_000,
                ..Account::default()
            },
        );
        
        program_test.add_account(
            player.pubkey(),
            Account {
                lamports: 1_000_000_000,
                ..Account::default()
            },
        );
        
        // Start the program test
        let (mut banks_client, payer, recent_blockhash) = program_test.start().await;
        
        // Initialize the casino with edge case house edge (0%)
        let house_edge = 0; // 0%
        let min_bet = 100_000; // 0.0001 SOL
        let max_bet = 1_000_000_000; // 1 SOL
        
        let init_instruction = crate::client::initialize(
            &authority.pubkey(),
            &casino_state_pubkey,
            house_edge,
            min_bet,
            max_bet,
        );
        
        let mut init_transaction = Transaction::new_with_payer(
            &[init_instruction],
            Some(&payer.pubkey()),
        );
        init_transaction.sign(&[&payer, &authority], recent_blockhash);
        
        banks_client.process_transaction(init_transaction).await.unwrap();
        
        // Place a bet
        let bet_amount = 500_000; // 0.0005 SOL
        
        let place_bet_instruction = crate::client::place_bet(
            &player.pubkey(),
            &casino_state_pubkey,
            &game_pubkey,
            game_id,
            bet_amount,
        );
        
        let mut bet_transaction = Transaction::new_with_payer(
            &[place_bet_instruction],
            Some(&payer.pubkey()),
        );
        bet_transaction.sign(&[&payer, &player], recent_blockhash);
        
        banks_client.process_transaction(bet_transaction).await.unwrap();
        
        // With 0% house edge, the max win should be equal to the bet amount
        // Try to settle with win amount equal to bet amount
        let win_amount = bet_amount;
        let result_hash = [2u8; 32];
        
        let settle_instruction = crate::client::settle_game(
            &authority.pubkey(),
            &casino_state_pubkey,
            &game_pubkey,
            &player.pubkey(),
            true,
            win_amount,
            result_hash,
        );
        
        let mut settle_transaction = Transaction::new_with_payer(
            &[settle_instruction],
            Some(&payer.pubkey()),
        );
        settle_transaction.sign(&[&payer, &authority], recent_blockhash);
        
        // This should succeed
        banks_client.process_transaction(settle_transaction).await.unwrap();
    }

    #[tokio::test]
    async fn test_max_house_edge() {
        let mut program_test = program_test();
        
        // Create test accounts
        let authority = Keypair::new();
        
        // Find PDAs
        let (casino_state_pubkey, _) = Pubkey::find_program_address(
            &[b"casino", authority.pubkey().as_ref()],
            &id::id(),
        );
        
        // Fund the accounts
        program_test.add_account(
            authority.pubkey(),
            Account {
                lamports: 1_000_000_000,
                ..Account::default()
            },
        );
        
        // Start the program test
        let (mut banks_client, payer, recent_blockhash) = program_test.start().await;
        
        // Try to initialize with maximum allowed house edge (10%)
        let max_house_edge = 1000; // 10%
        let min_bet = 100_000; // 0.0001 SOL
        let max_bet = 1_000_000_000; // 1 SOL
        
        let max_edge_instruction = crate::client::initialize(
            &authority.pubkey(),
            &casino_state_pubkey,
            max_house_edge,
            min_bet,
            max_bet,
        );
        
        let mut max_edge_transaction = Transaction::new_with_payer(
            &[max_edge_instruction],
            Some(&payer.pubkey()),
        );
        max_edge_transaction.sign(&[&payer, &authority], recent_blockhash);
        
        // This should succeed as 10% is the maximum allowed
        banks_client.process_transaction(max_edge_transaction).await.unwrap();
    }

    #[tokio::test]
    async fn test_settle_non_existent_game() {
        let mut program_test = program_test();
        
        // Create test accounts
        let authority = Keypair::new();
        let player = Keypair::new();
        
        // Find PDAs
        let (casino_state_pubkey, _) = Pubkey::find_program_address(
            &[b"casino", authority.pubkey().as_ref()],
            &id::id(),
        );
        
        let game_id = [1u8; 32];
        let (game_pubkey, _) = Pubkey::find_program_address(
            &[&game_id],
            &id::id(),
        );
        
        // Fund the accounts
        program_test.add_account(
            authority.pubkey(),
            Account {
                lamports: 1_000_000_000,
                ..Account::default()
            },
        );
        
        program_test.add_account(
            player.pubkey(),
            Account {
                lamports: 1_000_000_000,
                ..Account::default()
            },
        );
        
        // Start the program test
        let (mut banks_client, payer, recent_blockhash) = program_test.start().await;
        
        // Initialize the casino
        let house_edge = 250; // 2.5%
        let min_bet = 100_000; // 0.0001 SOL
        let max_bet = 1_000_000_000; // 1 SOL
        
        let init_instruction = crate::client::initialize(
            &authority.pubkey(),
            &casino_state_pubkey,
            house_edge,
            min_bet,
            max_bet,
        );
        
        let mut init_transaction = Transaction::new_with_payer(
            &[init_instruction],
            Some(&payer.pubkey()),
        );
        init_transaction.sign(&[&payer, &authority], recent_blockhash);
        
        banks_client.process_transaction(init_transaction).await.unwrap();
        
        // Try to settle a game that doesn't exist
        let win_amount = 500_000; // 0.0005 SOL
        let result_hash = [2u8; 32];
        
        let settle_instruction = crate::client::settle_game(
            &authority.pubkey(),
            &casino_state_pubkey,
            &game_pubkey,
            &player.pubkey(),
            true,
            win_amount,
            result_hash,
        );
        
        let mut settle_transaction = Transaction::new_with_payer(
            &[settle_instruction],
            Some(&payer.pubkey()),
        );
        settle_transaction.sign(&[&payer, &authority], recent_blockhash);
        
        // This should fail because the game doesn't exist
        let result = banks_client.process_transaction(settle_transaction).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_initialize_twice() {
        let mut program_test = program_test();
        
        // Create test accounts
        let authority = Keypair::new();
        
        // Find PDAs
        let (casino_state_pubkey, _) = Pubkey::find_program_address(
            &[b"casino", authority.pubkey().as_ref()],
            &id::id(),
        );
        
        // Fund the accounts
        program_test.add_account(
            authority.pubkey(),
            Account {
                lamports: 1_000_000_000,
                ..Account::default()
            },
        );
        
        // Start the program test
        let (mut banks_client, payer, recent_blockhash) = program_test.start().await;
        
        // Initialize the casino
        let house_edge = 250; // 2.5%
        let min_bet = 100_000; // 0.0001 SOL
        let max_bet = 1_000_000_000; // 1 SOL
        
        let init_instruction = crate::client::initialize(
            &authority.pubkey(),
            &casino_state_pubkey,
            house_edge,
            min_bet,
            max_bet,
        );
        
        let mut init_transaction = Transaction::new_with_payer(
            &[init_instruction],
            Some(&payer.pubkey()),
        );
        init_transaction.sign(&[&payer, &authority], recent_blockhash);
        
        banks_client.process_transaction(init_transaction).await.unwrap();
        
        // Try to initialize again with the same authority
        let second_init_instruction = crate::client::initialize(
            &authority.pubkey(),
            &casino_state_pubkey,
            house_edge,
            min_bet,
            max_bet,
        );
        
        let mut second_init_transaction = Transaction::new_with_payer(
            &[second_init_instruction],
            Some(&payer.pubkey()),
        );
        second_init_transaction.sign(&[&payer, &authority], recent_blockhash);
        
        // This should fail because the casino is already initialized
        let result = banks_client.process_transaction(second_init_transaction).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_settle_with_wrong_player() {
        let mut program_test = program_test();
        
        // Create test accounts
        let authority = Keypair::new();
        let player = Keypair::new();
        let wrong_player = Keypair::new();
        
        // Find PDAs
        let (casino_state_pubkey, _) = Pubkey::find_program_address(
            &[b"casino", authority.pubkey().as_ref()],
            &id::id(),
        );
        
        let game_id = [1u8; 32];
        let (game_pubkey, _) = Pubkey::find_program_address(
            &[&game_id],
            &id::id(),
        );
        
        // Fund the accounts
        program_test.add_account(
            authority.pubkey(),
            Account {
                lamports: 1_000_000_000,
                ..Account::default()
            },
        );
        
        program_test.add_account(
            player.pubkey(),
            Account {
                lamports: 1_000_000_000,
                ..Account::default()
            },
        );
        
        program_test.add_account(
            wrong_player.pubkey(),
            Account {
                lamports: 1_000_000_000,
                ..Account::default()
            },
        );
        
        // Start the program test
        let (mut banks_client, payer, recent_blockhash) = program_test.start().await;
        
        // Initialize the casino
        let house_edge = 250; // 2.5%
        let min_bet = 100_000; // 0.0001 SOL
        let max_bet = 1_000_000_000; // 1 SOL
        
        let init_instruction = crate::client::initialize(
            &authority.pubkey(),
            &casino_state_pubkey,
            house_edge,
            min_bet,
            max_bet,
        );
        
        let mut init_transaction = Transaction::new_with_payer(
            &[init_instruction],
            Some(&payer.pubkey()),
        );
        init_transaction.sign(&[&payer, &authority], recent_blockhash);
        
        banks_client.process_transaction(init_transaction).await.unwrap();
        
        // Place a bet
        let bet_amount = 500_000; // 0.0005 SOL
        
        let place_bet_instruction = crate::client::place_bet(
            &player.pubkey(),
            &casino_state_pubkey,
            &game_pubkey,
            game_id,
            bet_amount,
        );
        
        let mut bet_transaction = Transaction::new_with_payer(
            &[place_bet_instruction],
            Some(&payer.pubkey()),
        );
        bet_transaction.sign(&[&payer, &player], recent_blockhash);
        
        banks_client.process_transaction(bet_transaction).await.unwrap();
        
        // Try to settle the game with the wrong player
        let win_amount = 900_000; // 0.0009 SOL
        let result_hash = [2u8; 32];
        
        let settle_instruction = crate::client::settle_game(
            &authority.pubkey(),
            &casino_state_pubkey,
            &game_pubkey,
            &wrong_player.pubkey(),
            true,
            win_amount,
            result_hash,
        );
        
        let mut settle_transaction = Transaction::new_with_payer(
            &[settle_instruction],
            Some(&payer.pubkey()),
        );
        settle_transaction.sign(&[&payer, &authority], recent_blockhash);
        
        // This should fail because the player is wrong
        let result = banks_client.process_transaction(settle_transaction).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_place_bet_with_same_game_id() {
        let mut program_test = program_test();
        
        // Create test accounts
        let authority = Keypair::new();
        let player1 = Keypair::new();
        let player2 = Keypair::new();
        
        // Find PDAs
        let (casino_state_pubkey, _) = Pubkey::find_program_address(
            &[b"casino", authority.pubkey().as_ref()],
            &id::id(),
        );
        
        let game_id = [1u8; 32];
        let (game_pubkey, _) = Pubkey::find_program_address(
            &[&game_id],
            &id::id(),
        );
        
        // Fund the accounts
        program_test.add_account(
            authority.pubkey(),
            Account {
                lamports: 1_000_000_000,
                ..Account::default()
            },
        );
        
        program_test.add_account(
            player1.pubkey(),
            Account {
                lamports: 1_000_000_000,
                ..Account::default()
            },
        );
        
        program_test.add_account(
            player2.pubkey(),
            Account {
                lamports: 1_000_000_000,
                ..Account::default()
            },
        );
        
        // Start the program test
        let (mut banks_client, payer, recent_blockhash) = program_test.start().await;
        
        // Initialize the casino
        let house_edge = 250; // 2.5%
        let min_bet = 100_000; // 0.0001 SOL
        let max_bet = 1_000_000_000; // 1 SOL
        
        let init_instruction = crate::client::initialize(
            &authority.pubkey(),
            &casino_state_pubkey,
            house_edge,
            min_bet,
            max_bet,
        );
        
        let mut init_transaction = Transaction::new_with_payer(
            &[init_instruction],
            Some(&payer.pubkey()),
        );
        init_transaction.sign(&[&payer, &authority], recent_blockhash);
        
        banks_client.process_transaction(init_transaction).await.unwrap();
        
        // Player1 places a bet
        let bet_amount = 500_000; // 0.0005 SOL
        
        let place_bet_instruction = crate::client::place_bet(
            &player1.pubkey(),
            &casino_state_pubkey,
            &game_pubkey,
            game_id,
            bet_amount,
        );
        
        let mut bet_transaction = Transaction::new_with_payer(
            &[place_bet_instruction],
            Some(&payer.pubkey()),
        );
        bet_transaction.sign(&[&payer, &player1], recent_blockhash);
        
        banks_client.process_transaction(bet_transaction).await.unwrap();
        
        // Player2 tries to place a bet with the same game ID
        let second_bet_instruction = crate::client::place_bet(
            &player2.pubkey(),
            &casino_state_pubkey,
            &game_pubkey,
            game_id,
            bet_amount,
        );
        
        let mut second_bet_transaction = Transaction::new_with_payer(
            &[second_bet_instruction],
            Some(&payer.pubkey()),
        );
        second_bet_transaction.sign(&[&payer, &player2], recent_blockhash);
        
        // This should fail because the game ID is already in use
        let result = banks_client.process_transaction(second_bet_transaction).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_update_params_edge_cases() {
        let mut program_test = program_test();
        
        // Create test accounts
        let authority = Keypair::new();
        
        // Find PDAs
        let (casino_state_pubkey, _) = Pubkey::find_program_address(
            &[b"casino", authority.pubkey().as_ref()],
            &id::id(),
        );
        
        // Fund the accounts
        program_test.add_account(
            authority.pubkey(),
            Account {
                lamports: 1_000_000_000,
                ..Account::default()
            },
        );
        
        // Start the program test
        let (mut banks_client, payer, recent_blockhash) = program_test.start().await;
        
        // Initialize the casino
        let house_edge = 250; // 2.5%
        let min_bet = 100_000; // 0.0001 SOL
        let max_bet = 1_000_000_000; // 1 SOL
        
        let init_instruction = crate::client::initialize(
            &authority.pubkey(),
            &casino_state_pubkey,
            house_edge,
            min_bet,
            max_bet,
        );
        
        let mut init_transaction = Transaction::new_with_payer(
            &[init_instruction],
            Some(&payer.pubkey()),
        );
        init_transaction.sign(&[&payer, &authority], recent_blockhash);
        
        banks_client.process_transaction(init_transaction).await.unwrap();
        
        // Try to update with no parameters (should be a no-op)
        let no_params_instruction = crate::client::update_params(
            &authority.pubkey(),
            &casino_state_pubkey,
            None,
            None,
            None,
        );
        
        let mut no_params_transaction = Transaction::new_with_payer(
            &[no_params_instruction],
            Some(&payer.pubkey()),
        );
        no_params_transaction.sign(&[&payer, &authority], recent_blockhash);
        
        // This should succeed but not change anything
        banks_client.process_transaction(no_params_transaction).await.unwrap();
        
        // Try to update with zero min_bet
        let zero_min_bet_instruction = crate::client::update_params(
            &authority.pubkey(),
            &casino_state_pubkey,
            None,
            Some(0),
            None,
        );
        
        let mut zero_min_bet_transaction = Transaction::new_with_payer(
            &[zero_min_bet_instruction],
            Some(&payer.pubkey()),
        );
        zero_min_bet_transaction.sign(&[&payer, &authority], recent_blockhash);
        
        // This should fail because min_bet cannot be zero
        let result = banks_client.process_transaction(zero_min_bet_transaction).await;
        assert!(result.is_err());
    }
} 