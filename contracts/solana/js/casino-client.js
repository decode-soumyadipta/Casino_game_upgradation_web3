const {
  Connection,
  PublicKey,
  Keypair,
  Transaction,
  SystemProgram,
  TransactionInstruction,
  sendAndConfirmTransaction,
} = require('@solana/web3.js');
const { Buffer } = require('buffer');
const borsh = require('borsh');

// Program ID (replace with actual program ID after deployment)
const PROGRAM_ID = new PublicKey('Casin0Game111111111111111111111111111111111');

// Borsh schema for serializing instructions
const CasinoInstructionSchema = new Map([
  [
    'Initialize',
    {
      kind: 'struct',
      fields: [
        ['house_edge', 'u16'],
        ['min_bet', 'u64'],
        ['max_bet', 'u64'],
      ],
    },
  ],
  [
    'PlaceBet',
    {
      kind: 'struct',
      fields: [
        ['game_id', [32]],
        ['bet_amount', 'u64'],
      ],
    },
  ],
  [
    'SettleGame',
    {
      kind: 'struct',
      fields: [
        ['is_win', 'u8'],
        ['win_amount', 'u64'],
        ['result_hash', [32]],
      ],
    },
  ],
  [
    'UpdateParams',
    {
      kind: 'struct',
      fields: [
        ['house_edge_present', 'u8'],
        ['house_edge', 'u16'],
        ['min_bet_present', 'u8'],
        ['min_bet', 'u64'],
        ['max_bet_present', 'u8'],
        ['max_bet', 'u64'],
      ],
    },
  ],
  [
    'AddOperator',
    {
      kind: 'struct',
      fields: [],
    },
  ],
  [
    'RemoveOperator',
    {
      kind: 'struct',
      fields: [],
    },
  ],
]);

// Borsh schema for deserializing state
const CasinoStateSchema = new Map([
  [
    'CasinoState',
    {
      kind: 'struct',
      fields: [
        ['authority', [32]],
        ['house_edge', 'u16'],
        ['min_bet', 'u64'],
        ['max_bet', 'u64'],
        ['operators', ['pubkey']],
      ],
    },
  ],
]);

const GameStateSchema = new Map([
  [
    'GameState',
    {
      kind: 'struct',
      fields: [
        ['player', [32]],
        ['bet_amount', 'u64'],
        ['is_settled', 'u8'],
        ['is_win', 'u8'],
        ['win_amount', 'u64'],
        ['result_hash', [32]],
      ],
    },
  ],
]);

/**
 * CasinoClient class for interacting with the casino program
 */
class CasinoClient {
  /**
   * Constructor for CasinoClient
   * @param {Connection} connection - Solana connection
   * @param {Keypair} payer - Payer account
   */
  constructor(connection, payer) {
    this.connection = connection;
    this.payer = payer;
    this.programId = PROGRAM_ID;
  }

  /**
   * Find the casino state PDA
   * @param {PublicKey} authority - Authority public key
   * @returns {[PublicKey, number]} - Casino state address and bump seed
   */
  findCasinoStateAddress(authority) {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('casino'), authority.toBuffer()],
      this.programId
    );
  }

  /**
   * Find the game account PDA
   * @param {Buffer} gameId - Game ID as a 32-byte buffer
   * @returns {[PublicKey, number]} - Game address and bump seed
   */
  findGameAddress(gameId) {
    return PublicKey.findProgramAddressSync(
      [gameId],
      this.programId
    );
  }

  /**
   * Initialize the casino
   * @param {Keypair} authority - Authority keypair
   * @param {number} houseEdge - House edge in basis points (e.g., 250 = 2.5%)
   * @param {number} minBet - Minimum bet amount in lamports
   * @param {number} maxBet - Maximum bet amount in lamports
   * @returns {Promise<string>} - Transaction signature
   */
  async initialize(authority, houseEdge, minBet, maxBet) {
    const [casinoStateAddress] = this.findCasinoStateAddress(authority.publicKey);

    // Create instruction data
    const instructionData = {
      house_edge: houseEdge,
      min_bet: BigInt(minBet),
      max_bet: BigInt(maxBet),
    };

    // Serialize instruction
    const dataBuffer = Buffer.from([0]); // Instruction index 0 = Initialize
    const instructionBuffer = borsh.serialize(
      CasinoInstructionSchema,
      instructionData,
      'Initialize'
    );
    const data = Buffer.concat([dataBuffer, instructionBuffer]);

    // Create instruction
    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: authority.publicKey, isSigner: true, isWritable: true },
        { pubkey: casinoStateAddress, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId: this.programId,
      data,
    });

    // Create and send transaction
    const transaction = new Transaction().add(instruction);
    return await sendAndConfirmTransaction(
      this.connection,
      transaction,
      [this.payer, authority]
    );
  }

  /**
   * Place a bet
   * @param {Keypair} player - Player keypair
   * @param {Buffer} gameId - Game ID as a 32-byte buffer
   * @param {number} betAmount - Bet amount in lamports
   * @returns {Promise<string>} - Transaction signature
   */
  async placeBet(player, gameId, betAmount) {
    const [casinoStateAddress] = this.findCasinoStateAddress(this.payer.publicKey);
    const [gameAddress] = this.findGameAddress(gameId);

    // Create instruction data
    const instructionData = {
      game_id: Array.from(gameId),
      bet_amount: BigInt(betAmount),
    };

    // Serialize instruction
    const dataBuffer = Buffer.from([1]); // Instruction index 1 = PlaceBet
    const instructionBuffer = borsh.serialize(
      CasinoInstructionSchema,
      instructionData,
      'PlaceBet'
    );
    const data = Buffer.concat([dataBuffer, instructionBuffer]);

    // Create instruction
    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: player.publicKey, isSigner: true, isWritable: true },
        { pubkey: casinoStateAddress, isSigner: false, isWritable: false },
        { pubkey: gameAddress, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId: this.programId,
      data,
    });

    // Create and send transaction
    const transaction = new Transaction().add(instruction);
    return await sendAndConfirmTransaction(
      this.connection,
      transaction,
      [this.payer, player]
    );
  }

  /**
   * Settle a game
   * @param {Keypair} authority - Authority keypair
   * @param {Buffer} gameId - Game ID as a 32-byte buffer
   * @param {PublicKey} player - Player public key
   * @param {boolean} isWin - Whether the player won
   * @param {number} winAmount - Win amount in lamports
   * @param {Buffer} resultHash - Result hash as a 32-byte buffer
   * @returns {Promise<string>} - Transaction signature
   */
  async settleGame(authority, gameId, player, isWin, winAmount, resultHash) {
    const [casinoStateAddress] = this.findCasinoStateAddress(authority.publicKey);
    const [gameAddress] = this.findGameAddress(gameId);

    // Create instruction data
    const instructionData = {
      is_win: isWin ? 1 : 0,
      win_amount: BigInt(winAmount),
      result_hash: Array.from(resultHash),
    };

    // Serialize instruction
    const dataBuffer = Buffer.from([2]); // Instruction index 2 = SettleGame
    const instructionBuffer = borsh.serialize(
      CasinoInstructionSchema,
      instructionData,
      'SettleGame'
    );
    const data = Buffer.concat([dataBuffer, instructionBuffer]);

    // Create instruction
    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: authority.publicKey, isSigner: true, isWritable: false },
        { pubkey: casinoStateAddress, isSigner: false, isWritable: false },
        { pubkey: gameAddress, isSigner: false, isWritable: true },
        { pubkey: player, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId: this.programId,
      data,
    });

    // Create and send transaction
    const transaction = new Transaction().add(instruction);
    return await sendAndConfirmTransaction(
      this.connection,
      transaction,
      [this.payer, authority]
    );
  }

  /**
   * Update casino parameters
   * @param {Keypair} authority - Authority keypair
   * @param {number|null} houseEdge - New house edge in basis points
   * @param {number|null} minBet - New minimum bet amount in lamports
   * @param {number|null} maxBet - New maximum bet amount in lamports
   * @returns {Promise<string>} - Transaction signature
   */
  async updateParams(authority, houseEdge, minBet, maxBet) {
    const [casinoStateAddress] = this.findCasinoStateAddress(authority.publicKey);

    // Create instruction data
    const instructionData = {
      house_edge_present: houseEdge !== null ? 1 : 0,
      house_edge: houseEdge !== null ? houseEdge : 0,
      min_bet_present: minBet !== null ? 1 : 0,
      min_bet: minBet !== null ? BigInt(minBet) : BigInt(0),
      max_bet_present: maxBet !== null ? 1 : 0,
      max_bet: maxBet !== null ? BigInt(maxBet) : BigInt(0),
    };

    // Serialize instruction
    const dataBuffer = Buffer.from([3]); // Instruction index 3 = UpdateParams
    const instructionBuffer = borsh.serialize(
      CasinoInstructionSchema,
      instructionData,
      'UpdateParams'
    );
    const data = Buffer.concat([dataBuffer, instructionBuffer]);

    // Create instruction
    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: authority.publicKey, isSigner: true, isWritable: false },
        { pubkey: casinoStateAddress, isSigner: false, isWritable: true },
      ],
      programId: this.programId,
      data,
    });

    // Create and send transaction
    const transaction = new Transaction().add(instruction);
    return await sendAndConfirmTransaction(
      this.connection,
      transaction,
      [this.payer, authority]
    );
  }

  /**
   * Add an operator
   * @param {Keypair} authority - Authority keypair
   * @param {PublicKey} operator - Operator public key
   * @returns {Promise<string>} - Transaction signature
   */
  async addOperator(authority, operator) {
    const [casinoStateAddress] = this.findCasinoStateAddress(authority.publicKey);

    // Serialize instruction
    const dataBuffer = Buffer.from([4]); // Instruction index 4 = AddOperator
    const instructionBuffer = borsh.serialize(
      CasinoInstructionSchema,
      {},
      'AddOperator'
    );
    const data = Buffer.concat([dataBuffer, instructionBuffer]);

    // Create instruction
    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: authority.publicKey, isSigner: true, isWritable: false },
        { pubkey: casinoStateAddress, isSigner: false, isWritable: true },
        { pubkey: operator, isSigner: false, isWritable: false },
      ],
      programId: this.programId,
      data,
    });

    // Create and send transaction
    const transaction = new Transaction().add(instruction);
    return await sendAndConfirmTransaction(
      this.connection,
      transaction,
      [this.payer, authority]
    );
  }

  /**
   * Remove an operator
   * @param {Keypair} authority - Authority keypair
   * @param {PublicKey} operator - Operator public key
   * @returns {Promise<string>} - Transaction signature
   */
  async removeOperator(authority, operator) {
    const [casinoStateAddress] = this.findCasinoStateAddress(authority.publicKey);

    // Serialize instruction
    const dataBuffer = Buffer.from([5]); // Instruction index 5 = RemoveOperator
    const instructionBuffer = borsh.serialize(
      CasinoInstructionSchema,
      {},
      'RemoveOperator'
    );
    const data = Buffer.concat([dataBuffer, instructionBuffer]);

    // Create instruction
    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: authority.publicKey, isSigner: true, isWritable: false },
        { pubkey: casinoStateAddress, isSigner: false, isWritable: true },
        { pubkey: operator, isSigner: false, isWritable: false },
      ],
      programId: this.programId,
      data,
    });

    // Create and send transaction
    const transaction = new Transaction().add(instruction);
    return await sendAndConfirmTransaction(
      this.connection,
      transaction,
      [this.payer, authority]
    );
  }

  /**
   * Get casino state
   * @param {PublicKey} authority - Authority public key
   * @returns {Promise<Object>} - Casino state
   */
  async getCasinoState(authority) {
    const [casinoStateAddress] = this.findCasinoStateAddress(authority);
    const accountInfo = await this.connection.getAccountInfo(casinoStateAddress);
    
    if (!accountInfo) {
      throw new Error('Casino state account not found');
    }

    // Deserialize state
    const state = borsh.deserialize(
      CasinoStateSchema,
      'CasinoState',
      accountInfo.data
    );

    return {
      authority: new PublicKey(state.authority),
      houseEdge: state.house_edge,
      minBet: state.min_bet,
      maxBet: state.max_bet,
      operators: state.operators.map(op => new PublicKey(op)),
    };
  }

  /**
   * Get game state
   * @param {Buffer} gameId - Game ID as a 32-byte buffer
   * @returns {Promise<Object>} - Game state
   */
  async getGameState(gameId) {
    const [gameAddress] = this.findGameAddress(gameId);
    const accountInfo = await this.connection.getAccountInfo(gameAddress);
    
    if (!accountInfo) {
      throw new Error('Game account not found');
    }

    // Deserialize state
    const state = borsh.deserialize(
      GameStateSchema,
      'GameState',
      accountInfo.data
    );

    return {
      player: new PublicKey(state.player),
      betAmount: state.bet_amount,
      isSettled: state.is_settled === 1,
      isWin: state.is_win === 1,
      winAmount: state.win_amount,
      resultHash: Buffer.from(state.result_hash),
    };
  }
}

module.exports = { CasinoClient }; 