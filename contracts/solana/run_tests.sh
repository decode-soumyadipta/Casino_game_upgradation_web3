#!/bin/bash
# Bash script to run all Solana tests

echo -e "\033[0;32mRunning Solana tests...\033[0m"

# Run basic tests
echo -e "\n\033[0;36mRunning basic tests...\033[0m"
cargo test tests::test_program_id

# Run tokio integration tests
echo -e "\n\033[0;36mRunning tokio integration tests...\033[0m"
cargo test tokio_tests::test_initialize_casino -- --nocapture
cargo test tokio_tests::test_place_bet -- --nocapture
cargo test tokio_tests::test_settle_game -- --nocapture

# Run tokio security tests
echo -e "\n\033[0;36mRunning tokio security tests...\033[0m"
cargo test tokio_tests::test_unauthorized_access -- --nocapture
cargo test tokio_tests::test_input_validation -- --nocapture

# Run tokio edge case tests
echo -e "\n\033[0;36mRunning tokio edge case tests...\033[0m"
cargo test tokio_tests::test_zero_bet_amount -- --nocapture
cargo test tokio_tests::test_max_win_amount_calculation -- --nocapture

echo -e "\n\033[0;32mAll tests completed!\033[0m" 