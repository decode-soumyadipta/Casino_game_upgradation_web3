const {
  Connection,
  Keypair,
  PublicKey,
  clusterApiUrl,
} = require('@solana/web3.js');
const { CasinoClient } = require('./casino-client');
const fs = require('fs');
const crypto = require('crypto');

// Example usage of the CasinoClient
async function main() {
  // Connect to the Solana devnet
  const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');
  
  // Load or generate keypairs
  let authority, player;
  
  try {
    // Try to load existing keypairs from file
    const authorityData = JSON.parse(fs.readFileSync('./authority-keypair.json', 'utf-8'));
    const playerData = JSON.parse(fs.readFileSync('./player-keypair.json', 'utf-8'));
    
    authority = Keypair.fromSecretKey(new Uint8Array(authorityData));
    player = Keypair.fromSecretKey(new Uint8Array(playerData));
    
    console.log('Loaded existing keypairs');
  } catch (error) {
    // Generate new keypairs if files don't exist
    authority = Keypair.generate();
    player = Keypair.generate();
    
    // Save keypairs to file for future use
    fs.writeFileSync('./authority-keypair.json', JSON.stringify(Array.from(authority.secretKey)));
    fs.writeFileSync('./player-keypair.json', JSON.stringify(Array.from(player.secretKey)));
    
    console.log('Generated new keypairs');
  }
  
  console.log('Authority:', authority.publicKey.toString());
  console.log('Player:', player.publicKey.toString());
  
  // Create casino client
  const casinoClient = new CasinoClient(connection, authority);
  
  // Fund accounts if needed (this would be done manually on devnet)
  console.log('Please fund these accounts on devnet using the Solana CLI or a faucet:');
  console.log(`solana airdrop 2 ${authority.publicKey.toString()} --url devnet`);
  console.log(`solana airdrop 2 ${player.publicKey.toString()} --url devnet`);
  
  // Wait for user to fund accounts
  console.log('Press any key after funding accounts...');
  await new Promise(resolve => process.stdin.once('data', resolve));
  
  try {
    // Initialize the casino
    console.log('\nInitializing casino...');
    const houseEdge = 250; // 2.5%
    const minBet = 100_000; // 0.0001 SOL
    const maxBet = 1_000_000_000; // 1 SOL
    
    const initTxId = await casinoClient.initialize(
      authority,
      houseEdge,
      minBet,
      maxBet
    );
    
    console.log('Casino initialized:', initTxId);
    
    // Get casino state
    const casinoState = await casinoClient.getCasinoState(authority.publicKey);
    console.log('\nCasino state:');
    console.log('Authority:', casinoState.authority.toString());
    console.log('House edge:', casinoState.houseEdge / 100, '%');
    console.log('Min bet:', casinoState.minBet.toString(), 'lamports');
    console.log('Max bet:', casinoState.maxBet.toString(), 'lamports');
    console.log('Operators:', casinoState.operators.map(op => op.toString()));
    
    // Place a bet
    console.log('\nPlacing bet...');
    const gameId = crypto.randomBytes(32);
    const betAmount = 500_000; // 0.0005 SOL
    
    const betTxId = await casinoClient.placeBet(
      player,
      gameId,
      betAmount
    );
    
    console.log('Bet placed:', betTxId);
    console.log('Game ID:', gameId.toString('hex'));
    
    // Get game state
    const gameState = await casinoClient.getGameState(gameId);
    console.log('\nGame state:');
    console.log('Player:', gameState.player.toString());
    console.log('Bet amount:', gameState.betAmount.toString(), 'lamports');
    console.log('Is settled:', gameState.isSettled);
    
    // Simulate a random outcome
    const isWin = Math.random() > 0.5;
    const winAmount = isWin ? 900_000 : 0; // 0.0009 SOL if win, 0 if loss
    const resultHash = crypto.randomBytes(32);
    
    // Settle the game
    console.log('\nSettling game...');
    console.log('Outcome:', isWin ? 'WIN' : 'LOSS');
    
    const settleTxId = await casinoClient.settleGame(
      authority,
      gameId,
      player.publicKey,
      isWin,
      winAmount,
      resultHash
    );
    
    console.log('Game settled:', settleTxId);
    
    // Get updated game state
    const updatedGameState = await casinoClient.getGameState(gameId);
    console.log('\nUpdated game state:');
    console.log('Is settled:', updatedGameState.isSettled);
    console.log('Is win:', updatedGameState.isWin);
    console.log('Win amount:', updatedGameState.winAmount.toString(), 'lamports');
    console.log('Result hash:', updatedGameState.resultHash.toString('hex'));
    
    // Update casino parameters
    console.log('\nUpdating casino parameters...');
    const newHouseEdge = 300; // 3%
    
    const updateTxId = await casinoClient.updateParams(
      authority,
      newHouseEdge,
      null,
      null
    );
    
    console.log('Parameters updated:', updateTxId);
    
    // Get updated casino state
    const updatedCasinoState = await casinoClient.getCasinoState(authority.publicKey);
    console.log('\nUpdated casino state:');
    console.log('House edge:', updatedCasinoState.houseEdge / 100, '%');
    
    console.log('\nExample completed successfully!');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the example
main().catch(console.error); 