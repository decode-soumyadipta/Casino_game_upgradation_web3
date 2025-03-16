#!/usr/bin/env pwsh
# PowerShell script to run all Solana tests

Write-Host "Running Solana tests..." -ForegroundColor Green

# Ensure cargo is in the PATH
$env:PATH += ";$env:USERPROFILE\.cargo\bin"

# Run basic tests
Write-Host "`nRunning basic tests..." -ForegroundColor Cyan
cargo test tests::test_program_id

# Run tokio integration tests
Write-Host "`nRunning tokio integration tests..." -ForegroundColor Cyan
cargo test tokio_tests::test_initialize_casino -- --nocapture
cargo test tokio_tests::test_place_bet -- --nocapture
cargo test tokio_tests::test_settle_game -- --nocapture

# Run tokio security tests
Write-Host "`nRunning tokio security tests..." -ForegroundColor Cyan
cargo test tokio_tests::test_unauthorized_access -- --nocapture
cargo test tokio_tests::test_input_validation -- --nocapture

# Run tokio edge case tests
Write-Host "`nRunning tokio edge case tests..." -ForegroundColor Cyan
cargo test tokio_tests::test_zero_bet_amount -- --nocapture
cargo test tokio_tests::test_max_win_amount_calculation -- --nocapture

Write-Host "`nAll tests completed!" -ForegroundColor Green 