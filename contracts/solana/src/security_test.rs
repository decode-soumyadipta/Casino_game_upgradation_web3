#[cfg(test)]
mod security_tests {
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
    async fn test_unauthorized_access() {
        let mut program_test = program_test();
        
        // Create test accounts
        let authority = Keypair::new();
        let attacker = Keypair::new();
        
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
        
        program_test.add_account(
            attacker.pubkey(),
            Account {
                lamports: 1_000_000_000,
                ..Account::default()
            },
        );
        
        // Start the program test
        let (mut banks_client, payer, recent_blockhash) = program_test.start().await;
        
        // Initialize the casino as the legitimate authority
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
        
        // Attacker tries to update parameters
        let update_instruction = crate::client::update_params(
            &attacker.pubkey(),
            &casino_state_pubkey,
            Some(300),
            Some(200_000),
            Some(2_000_000_000),
        );
        
        let mut update_transaction = Transaction::new_with_payer(
            &[update_instruction],
            Some(&payer.pubkey()),
        );
        update_transaction.sign(&[&payer, &attacker], recent_blockhash);
        
        // This should fail because attacker is not the authority
        let result = banks_client.process_transaction(update_transaction).await;
        assert!(result.is_err());
        
        // Attacker tries to add themselves as an operator
        let add_operator_instruction = crate::client::add_operator(
            &attacker.pubkey(),
            &casino_state_pubkey,
            &attacker.pubkey(),
        );
        
        let mut add_transaction = Transaction::new_with_payer(
            &[add_operator_instruction],
            Some(&payer.pubkey()),
        );
        add_transaction.sign(&[&payer, &attacker], recent_blockhash);
        
        // This should fail because attacker is not the authority
        let result = banks_client.process_transaction(add_transaction).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_input_validation() {
        let mut program_test = program_test();
        
        // Create test accounts
        let authority = Keypair::new();
        let player = Keypair::new();
        
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
        
        program_test.add_account(
            player.pubkey(),
            Account {
                lamports: 1_000_000_000,
                ..Account::default()
            },
        );
        
        // Start the program test
        let (mut banks_client, payer, recent_blockhash) = program_test.start().await;
        
        // Try to initialize with invalid house edge (>10%)
        let invalid_house_edge = 1100; // 11%
        let min_bet = 100_000; // 0.0001 SOL
        let max_bet = 1_000_000_000; // 1 SOL
        
        let invalid_init_instruction = crate::client::initialize(
            &authority.pubkey(),
            &casino_state_pubkey,
            invalid_house_edge,
            min_bet,
            max_bet,
        );
        
        let mut invalid_init_transaction = Transaction::new_with_payer(
            &[invalid_init_instruction],
            Some(&payer.pubkey()),
        );
        invalid_init_transaction.sign(&[&payer, &authority], recent_blockhash);
        
        // This should fail because house edge is too high
        let result = banks_client.process_transaction(invalid_init_transaction).await;
        assert!(result.is_err());
        
        // Initialize with valid parameters
        let valid_house_edge = 250; // 2.5%
        
        let valid_init_instruction = crate::client::initialize(
            &authority.pubkey(),
            &casino_state_pubkey,
            valid_house_edge,
            min_bet,
            max_bet,
        );
        
        let mut valid_init_transaction = Transaction::new_with_payer(
            &[valid_init_instruction],
            Some(&payer.pubkey()),
        );
        valid_init_transaction.sign(&[&payer, &authority], recent_blockhash);
        
        banks_client.process_transaction(valid_init_transaction).await.unwrap();
        
        // Try to initialize with min_bet > max_bet
        let invalid_min_bet = 2_000_000_000; // 2 SOL
        let invalid_max_bet = 1_000_000_000; // 1 SOL
        
        let invalid_params_instruction = crate::client::update_params(
            &authority.pubkey(),
            &casino_state_pubkey,
            None,
            Some(invalid_min_bet),
            Some(invalid_max_bet),
        );
        
        let mut invalid_params_transaction = Transaction::new_with_payer(
            &[invalid_params_instruction],
            Some(&payer.pubkey()),
        );
        invalid_params_transaction.sign(&[&payer, &authority], recent_blockhash);
        
        // This should fail because min_bet > max_bet
        let result = banks_client.process_transaction(invalid_params_transaction).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_bet_limits() {
        let mut program_test = program_test();
        
        // Create test accounts
        let authority = Keypair::new();
        let player = Keypair::new();
        
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
        
        // Try to place a bet below minimum
        let game_id_1 = [1u8; 32];
        let (game_pubkey_1, _) = Pubkey::find_program_address(
            &[&game_id_1],
            &id::id(),
        );
        
        let below_min_bet = 50_000; // 0.00005 SOL
        
        let below_min_instruction = crate::client::place_bet(
            &player.pubkey(),
            &casino_state_pubkey,
            &game_pubkey_1,
            game_id_1,
            below_min_bet,
        );
        
        let mut below_min_transaction = Transaction::new_with_payer(
            &[below_min_instruction],
            Some(&payer.pubkey()),
        );
        below_min_transaction.sign(&[&payer, &player], recent_blockhash);
        
        // This should fail because bet is below minimum
        let result = banks_client.process_transaction(below_min_transaction).await;
        assert!(result.is_err());
        
        // Try to place a bet above maximum
        let game_id_2 = [2u8; 32];
        let (game_pubkey_2, _) = Pubkey::find_program_address(
            &[&game_id_2],
            &id::id(),
        );
        
        let above_max_bet = 1_500_000_000; // 1.5 SOL
        
        let above_max_instruction = crate::client::place_bet(
            &player.pubkey(),
            &casino_state_pubkey,
            &game_pubkey_2,
            game_id_2,
            above_max_bet,
        );
        
        let mut above_max_transaction = Transaction::new_with_payer(
            &[above_max_instruction],
            Some(&payer.pubkey()),
        );
        above_max_transaction.sign(&[&payer, &player], recent_blockhash);
        
        // This should fail because bet is above maximum
        let result = banks_client.process_transaction(above_max_transaction).await;
        assert!(result.is_err());
        
        // Place a valid bet
        let game_id_3 = [3u8; 32];
        let (game_pubkey_3, _) = Pubkey::find_program_address(
            &[&game_id_3],
            &id::id(),
        );
        
        let valid_bet = 500_000; // 0.0005 SOL
        
        let valid_bet_instruction = crate::client::place_bet(
            &player.pubkey(),
            &casino_state_pubkey,
            &game_pubkey_3,
            game_id_3,
            valid_bet,
        );
        
        let mut valid_bet_transaction = Transaction::new_with_payer(
            &[valid_bet_instruction],
            Some(&payer.pubkey()),
        );
        valid_bet_transaction.sign(&[&payer, &player], recent_blockhash);
        
        // This should succeed
        banks_client.process_transaction(valid_bet_transaction).await.unwrap();
    }

    #[tokio::test]
    async fn test_win_amount_validation() {
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
        
        // Calculate maximum possible win with house edge
        let basis_points = 10000;
        let max_possible_win = bet_amount * basis_points / (basis_points - house_edge as u64);
        
        // Try to settle with win amount too high
        let excessive_win_amount = max_possible_win + 100_000;
        let result_hash = [2u8; 32];
        
        let excessive_settle_instruction = crate::client::settle_game(
            &authority.pubkey(),
            &casino_state_pubkey,
            &game_pubkey,
            &player.pubkey(),
            true,
            excessive_win_amount,
            result_hash,
        );
        
        let mut excessive_settle_transaction = Transaction::new_with_payer(
            &[excessive_settle_instruction],
            Some(&payer.pubkey()),
        );
        excessive_settle_transaction.sign(&[&payer, &authority], recent_blockhash);
        
        // This should fail because win amount is too high
        let result = banks_client.process_transaction(excessive_settle_transaction).await;
        assert!(result.is_err());
        
        // Settle with valid win amount
        let valid_win_amount = max_possible_win - 1;
        
        let valid_settle_instruction = crate::client::settle_game(
            &authority.pubkey(),
            &casino_state_pubkey,
            &game_pubkey,
            &player.pubkey(),
            true,
            valid_win_amount,
            result_hash,
        );
        
        let mut valid_settle_transaction = Transaction::new_with_payer(
            &[valid_settle_instruction],
            Some(&payer.pubkey()),
        );
        valid_settle_transaction.sign(&[&payer, &authority], recent_blockhash);
        
        // This should succeed
        banks_client.process_transaction(valid_settle_transaction).await.unwrap();
    }

    #[tokio::test]
    async fn test_double_settlement() {
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
        
        // Settle the game
        let win_amount = 900_000; // 0.0009 SOL
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
        
        banks_client.process_transaction(settle_transaction).await.unwrap();
        
        // Try to settle the same game again
        let second_win_amount = 800_000; // 0.0008 SOL
        let second_result_hash = [3u8; 32];
        
        let second_settle_instruction = crate::client::settle_game(
            &authority.pubkey(),
            &casino_state_pubkey,
            &game_pubkey,
            &player.pubkey(),
            true,
            second_win_amount,
            second_result_hash,
        );
        
        let mut second_settle_transaction = Transaction::new_with_payer(
            &[second_settle_instruction],
            Some(&payer.pubkey()),
        );
        second_settle_transaction.sign(&[&payer, &authority], recent_blockhash);
        
        // This should fail because the game is already settled
        let result = banks_client.process_transaction(second_settle_transaction).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_operator_management() {
        let mut program_test = program_test();
        
        // Create test accounts
        let authority = Keypair::new();
        let operator = Keypair::new();
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
            operator.pubkey(),
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
        
        // Try to settle game as non-operator
        let win_amount = 900_000; // 0.0009 SOL
        let result_hash = [2u8; 32];
        
        let non_operator_settle_instruction = crate::client::settle_game(
            &operator.pubkey(),
            &casino_state_pubkey,
            &game_pubkey,
            &player.pubkey(),
            true,
            win_amount,
            result_hash,
        );
        
        let mut non_operator_settle_transaction = Transaction::new_with_payer(
            &[non_operator_settle_instruction],
            Some(&payer.pubkey()),
        );
        non_operator_settle_transaction.sign(&[&payer, &operator], recent_blockhash);
        
        // This should fail because operator is not authorized
        let result = banks_client.process_transaction(non_operator_settle_transaction).await;
        assert!(result.is_err());
        
        // Add operator
        let add_operator_instruction = crate::client::add_operator(
            &authority.pubkey(),
            &casino_state_pubkey,
            &operator.pubkey(),
        );
        
        let mut add_operator_transaction = Transaction::new_with_payer(
            &[add_operator_instruction],
            Some(&payer.pubkey()),
        );
        add_operator_transaction.sign(&[&payer, &authority], recent_blockhash);
        
        banks_client.process_transaction(add_operator_transaction).await.unwrap();
        
        // Now try to settle game as operator
        let operator_settle_instruction = crate::client::settle_game(
            &operator.pubkey(),
            &casino_state_pubkey,
            &game_pubkey,
            &player.pubkey(),
            true,
            win_amount,
            result_hash,
        );
        
        let mut operator_settle_transaction = Transaction::new_with_payer(
            &[operator_settle_instruction],
            Some(&payer.pubkey()),
        );
        operator_settle_transaction.sign(&[&payer, &operator], recent_blockhash);
        
        // This should succeed
        banks_client.process_transaction(operator_settle_transaction).await.unwrap();
        
        // Try to remove the authority as an operator
        let remove_authority_instruction = crate::client::remove_operator(
            &authority.pubkey(),
            &casino_state_pubkey,
            &authority.pubkey(),
        );
        
        let mut remove_authority_transaction = Transaction::new_with_payer(
            &[remove_authority_instruction],
            Some(&payer.pubkey()),
        );
        remove_authority_transaction.sign(&[&payer, &authority], recent_blockhash);
        
        // This should fail because authority cannot be removed
        let result = banks_client.process_transaction(remove_authority_transaction).await;
        assert!(result.is_err());
    }
} 