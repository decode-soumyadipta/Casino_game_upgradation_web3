// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "./CasinoGame.sol";
import "./RandomnessProvider.sol";

/**
 * @title RouletteGame
 * @dev Contract for the Roulette game
 */
contract RouletteGame is Ownable, ReentrancyGuard {
    using SafeMath for uint256;
    
    // Bet types
    enum BetType {
        Number,     // Single number (0-36)
        Red,        // Red numbers
        Black,      // Black numbers
        Even,       // Even numbers
        Odd,        // Odd numbers
        Low,        // Numbers 1-18
        High,       // Numbers 19-36
        Dozen1,     // Numbers 1-12
        Dozen2,     // Numbers 13-24
        Dozen3,     // Numbers 25-36
        Column1,    // First column (1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34)
        Column2,    // Second column (2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35)
        Column3     // Third column (3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36)
    }
    
    // Bet structure
    struct Bet {
        BetType betType;
        uint256 number;  // Only used for Number bet type
        uint256 amount;
    }
    
    // Game structure
    struct RouletteGameData {
        address player;
        Bet[] bets;
        uint256 totalBetAmount;
        uint256 winAmount;
        uint256 spinResult;
        bool isSettled;
        uint256 timestamp;
    }
    
    // State variables
    CasinoGame private casinoGame;
    RandomnessProvider private randomnessProvider;
    mapping(bytes32 => RouletteGameData) private rouletteGames;
    
    // Constants
    uint256 private constant MAX_NUMBER = 36;
    uint256 private constant STRAIGHT_UP_PAYOUT = 35; // 35:1 payout for single number
    uint256 private constant SPLIT_PAYOUT = 17; // 17:1 payout for split
    uint256 private constant STREET_PAYOUT = 11; // 11:1 payout for street
    uint256 private constant CORNER_PAYOUT = 8; // 8:1 payout for corner
    uint256 private constant SIX_LINE_PAYOUT = 5; // 5:1 payout for six line
    uint256 private constant COLUMN_PAYOUT = 2; // 2:1 payout for column
    uint256 private constant DOZEN_PAYOUT = 2; // 2:1 payout for dozen
    uint256 private constant EVEN_MONEY_PAYOUT = 1; // 1:1 payout for even money bets
    
    // Events
    event BetPlaced(bytes32 indexed gameId, address indexed player, uint256 totalBetAmount);
    event SpinInitiated(bytes32 indexed gameId);
    event GameSettled(bytes32 indexed gameId, uint256 spinResult, uint256 winAmount);
    
    // Red numbers on a standard roulette wheel
    uint256[] private redNumbers = [
        1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36
    ];
    
    /**
     * @dev Constructor to initialize the contract
     * @param _casinoGame Address of the CasinoGame contract
     * @param _randomnessProvider Address of the RandomnessProvider contract
     */
    constructor(address _casinoGame, address _randomnessProvider) {
        casinoGame = CasinoGame(_casinoGame);
        randomnessProvider = RandomnessProvider(_randomnessProvider);
    }
    
    /**
     * @dev Places bets for a roulette game
     * @param _gameId Unique identifier for the game
     * @param _betTypes Array of bet types
     * @param _numbers Array of numbers (only used for Number bet type)
     * @param _amounts Array of bet amounts
     */
    function placeBets(
        bytes32 _gameId,
        BetType[] calldata _betTypes,
        uint256[] calldata _numbers,
        uint256[] calldata _amounts
    ) 
        external 
        nonReentrant 
    {
        require(_betTypes.length > 0, "No bets provided");
        require(_betTypes.length == _numbers.length, "Bet types and numbers length mismatch");
        require(_betTypes.length == _amounts.length, "Bet types and amounts length mismatch");
        require(rouletteGames[_gameId].player == address(0), "Game already exists");
        
        uint256 totalBetAmount = 0;
        
        // Calculate total bet amount
        for (uint256 i = 0; i < _amounts.length; i++) {
            totalBetAmount = totalBetAmount.add(_amounts[i]);
            
            // Validate bet type and number
            if (_betTypes[i] == BetType.Number) {
                require(_numbers[i] <= MAX_NUMBER, "Invalid number");
            }
        }
        
        // Place bet in the main casino contract
        require(casinoGame.placeBet(_gameId, totalBetAmount), "Failed to place bet");
        
        // Create roulette game data
        RouletteGameData storage game = rouletteGames[_gameId];
        game.player = msg.sender;
        game.totalBetAmount = totalBetAmount;
        game.timestamp = block.timestamp;
        
        // Add bets to the game
        for (uint256 i = 0; i < _betTypes.length; i++) {
            game.bets.push(Bet({
                betType: _betTypes[i],
                number: _numbers[i],
                amount: _amounts[i]
            }));
        }
        
        emit BetPlaced(_gameId, msg.sender, totalBetAmount);
    }
    
    /**
     * @dev Initiates a spin for a roulette game
     * @param _gameId Unique identifier for the game
     */
    function spin(bytes32 _gameId) external onlyOwner {
        RouletteGameData storage game = rouletteGames[_gameId];
        require(game.player != address(0), "Game does not exist");
        require(!game.isSettled, "Game already settled");
        
        // Request randomness from the provider
        randomnessProvider.requestRandomness(_gameId);
        
        emit SpinInitiated(_gameId);
    }
    
    /**
     * @dev Settles a roulette game
     * @param _gameId Unique identifier for the game
     */
    function settleGame(bytes32 _gameId) external onlyOwner nonReentrant {
        RouletteGameData storage game = rouletteGames[_gameId];
        require(game.player != address(0), "Game does not exist");
        require(!game.isSettled, "Game already settled");
        
        // Get random result
        (uint256 randomNumber, bool fulfilled) = randomnessProvider.getRandomResult(_gameId);
        require(fulfilled, "Randomness not yet fulfilled");
        
        // Calculate spin result (0-36)
        uint256 spinResult = randomNumber % 37;
        game.spinResult = spinResult;
        
        // Calculate winnings
        uint256 totalWinAmount = 0;
        
        for (uint256 i = 0; i < game.bets.length; i++) {
            Bet memory bet = game.bets[i];
            uint256 winAmount = 0;
            
            if (bet.betType == BetType.Number && bet.number == spinResult) {
                // Straight up bet (35:1)
                winAmount = bet.amount.mul(STRAIGHT_UP_PAYOUT + 1);
            } else if (bet.betType == BetType.Red && isRed(spinResult)) {
                // Red bet (1:1)
                winAmount = bet.amount.mul(EVEN_MONEY_PAYOUT + 1);
            } else if (bet.betType == BetType.Black && !isRed(spinResult) && spinResult != 0) {
                // Black bet (1:1)
                winAmount = bet.amount.mul(EVEN_MONEY_PAYOUT + 1);
            } else if (bet.betType == BetType.Even && spinResult % 2 == 0 && spinResult != 0) {
                // Even bet (1:1)
                winAmount = bet.amount.mul(EVEN_MONEY_PAYOUT + 1);
            } else if (bet.betType == BetType.Odd && spinResult % 2 == 1) {
                // Odd bet (1:1)
                winAmount = bet.amount.mul(EVEN_MONEY_PAYOUT + 1);
            } else if (bet.betType == BetType.Low && spinResult >= 1 && spinResult <= 18) {
                // Low bet (1:1)
                winAmount = bet.amount.mul(EVEN_MONEY_PAYOUT + 1);
            } else if (bet.betType == BetType.High && spinResult >= 19 && spinResult <= 36) {
                // High bet (1:1)
                winAmount = bet.amount.mul(EVEN_MONEY_PAYOUT + 1);
            } else if (bet.betType == BetType.Dozen1 && spinResult >= 1 && spinResult <= 12) {
                // First dozen bet (2:1)
                winAmount = bet.amount.mul(DOZEN_PAYOUT + 1);
            } else if (bet.betType == BetType.Dozen2 && spinResult >= 13 && spinResult <= 24) {
                // Second dozen bet (2:1)
                winAmount = bet.amount.mul(DOZEN_PAYOUT + 1);
            } else if (bet.betType == BetType.Dozen3 && spinResult >= 25 && spinResult <= 36) {
                // Third dozen bet (2:1)
                winAmount = bet.amount.mul(DOZEN_PAYOUT + 1);
            } else if (bet.betType == BetType.Column1 && spinResult % 3 == 1) {
                // First column bet (2:1)
                winAmount = bet.amount.mul(COLUMN_PAYOUT + 1);
            } else if (bet.betType == BetType.Column2 && spinResult % 3 == 2) {
                // Second column bet (2:1)
                winAmount = bet.amount.mul(COLUMN_PAYOUT + 1);
            } else if (bet.betType == BetType.Column3 && spinResult % 3 == 0 && spinResult != 0) {
                // Third column bet (2:1)
                winAmount = bet.amount.mul(COLUMN_PAYOUT + 1);
            }
            
            totalWinAmount = totalWinAmount.add(winAmount);
        }
        
        // Update game data
        game.winAmount = totalWinAmount;
        game.isSettled = true;
        
        // Settle the game in the main casino contract
        bytes32 resultHash = keccak256(abi.encodePacked(_gameId, spinResult, totalWinAmount));
        casinoGame.settleGame(_gameId, totalWinAmount > 0, totalWinAmount, resultHash);
        
        emit GameSettled(_gameId, spinResult, totalWinAmount);
    }
    
    /**
     * @dev Gets details of a roulette game
     * @param _gameId Unique identifier for the game
     * @return player Address of the player
     * @return totalBetAmount Total amount bet
     * @return winAmount Amount won
     * @return spinResult Result of the spin
     * @return isSettled Whether the game has been settled
     * @return timestamp Time when the game was created
     */
    function getGame(bytes32 _gameId) 
        external 
        view 
        returns (
            address player,
            uint256 totalBetAmount,
            uint256 winAmount,
            uint256 spinResult,
            bool isSettled,
            uint256 timestamp
        ) 
    {
        RouletteGameData storage game = rouletteGames[_gameId];
        return (
            game.player,
            game.totalBetAmount,
            game.winAmount,
            game.spinResult,
            game.isSettled,
            game.timestamp
        );
    }
    
    /**
     * @dev Gets the bets for a roulette game
     * @param _gameId Unique identifier for the game
     * @return betTypes Array of bet types
     * @return numbers Array of numbers
     * @return amounts Array of bet amounts
     */
    function getGameBets(bytes32 _gameId) 
        external 
        view 
        returns (
            BetType[] memory betTypes,
            uint256[] memory numbers,
            uint256[] memory amounts
        ) 
    {
        RouletteGameData storage game = rouletteGames[_gameId];
        uint256 betsLength = game.bets.length;
        
        betTypes = new BetType[](betsLength);
        numbers = new uint256[](betsLength);
        amounts = new uint256[](betsLength);
        
        for (uint256 i = 0; i < betsLength; i++) {
            betTypes[i] = game.bets[i].betType;
            numbers[i] = game.bets[i].number;
            amounts[i] = game.bets[i].amount;
        }
        
        return (betTypes, numbers, amounts);
    }
    
    /**
     * @dev Checks if a number is red
     * @param _number Number to check
     * @return isRed Whether the number is red
     */
    function isRed(uint256 _number) internal view returns (bool) {
        if (_number == 0) return false;
        
        for (uint256 i = 0; i < redNumbers.length; i++) {
            if (redNumbers[i] == _number) {
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * @dev Updates the CasinoGame contract address (can only be called by the owner)
     * @param _casinoGame New CasinoGame contract address
     */
    function updateCasinoGame(address _casinoGame) external onlyOwner {
        require(_casinoGame != address(0), "Invalid address");
        casinoGame = CasinoGame(_casinoGame);
    }
    
    /**
     * @dev Updates the RandomnessProvider contract address (can only be called by the owner)
     * @param _randomnessProvider New RandomnessProvider contract address
     */
    function updateRandomnessProvider(address _randomnessProvider) external onlyOwner {
        require(_randomnessProvider != address(0), "Invalid address");
        randomnessProvider = RandomnessProvider(_randomnessProvider);
    }
} 