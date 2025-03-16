// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title MockCasinoGame
 * @dev A simplified version of the CasinoGame contract for testing
 */
contract MockCasinoGame is ReentrancyGuard, Ownable, Pausable {
    uint256 public houseEdge;
    uint256 public minBet;
    uint256 public maxBet;
    uint256 public constant MAX_HOUSE_EDGE = 1000; // 10%

    struct Game {
        address player;
        uint256 betAmount;
        bool isSettled;
        bool isWin;
        uint256 winAmount;
    }

    mapping(uint256 => Game) private _games;
    mapping(address => uint256) private _balances;
    uint256 private _nextGameId = 1;

    event BetPlaced(uint256 indexed gameId, address indexed player, uint256 betAmount);
    event GameSettled(uint256 indexed gameId, address indexed player, bool isWin, uint256 winAmount);
    event Withdrawal(address indexed player, uint256 amount);
    event Deposit(address indexed player, uint256 amount);

    constructor(address randomnessProvider) Ownable(msg.sender) {
        // Randomness provider is not used in this mock
    }

    /**
     * @dev Sets the house edge in basis points (1/100 of a percent)
     * @param _newHouseEdge The new house edge in basis points
     */
    function setHouseEdge(uint256 _newHouseEdge) external onlyOwner {
        require(_newHouseEdge <= MAX_HOUSE_EDGE, "House edge too high");
        houseEdge = _newHouseEdge;
    }

    /**
     * @dev Sets the minimum and maximum bet amounts
     * @param _minBet The minimum bet amount
     * @param _maxBet The maximum bet amount
     */
    function setBetLimits(uint256 _minBet, uint256 _maxBet) external onlyOwner {
        require(_minBet <= _maxBet, "Min bet must be <= max bet");
        minBet = _minBet;
        maxBet = _maxBet;
    }

    /**
     * @dev Places a bet
     */
    function placeBet() external payable whenNotPaused {
        require(msg.value >= minBet, "Bet below minimum");
        require(msg.value <= maxBet, "Bet above maximum");

        uint256 gameId = _nextGameId++;
        _games[gameId] = Game({
            player: msg.sender,
            betAmount: msg.value,
            isSettled: false,
            isWin: false,
            winAmount: 0
        });

        emit BetPlaced(gameId, msg.sender, msg.value);
    }

    /**
     * @dev Settles a game
     * @param gameId The ID of the game to settle
     * @param isWin Whether the player won
     * @param winAmount The amount won by the player
     */
    function settleGame(uint256 gameId, bool isWin, uint256 winAmount) external onlyOwner {
        Game storage game = _games[gameId];
        require(!game.isSettled, "Game already settled");
        require(game.player != address(0), "Game does not exist");

        game.isSettled = true;
        game.isWin = isWin;
        game.winAmount = winAmount;

        if (isWin) {
            _balances[game.player] += winAmount;
        }

        emit GameSettled(gameId, game.player, isWin, winAmount);
    }

    /**
     * @dev Withdraws funds from the player's balance
     * @param amount The amount to withdraw
     */
    function withdraw(uint256 amount) external nonReentrant {
        require(_balances[msg.sender] >= amount, "Insufficient balance");
        
        _balances[msg.sender] -= amount;
        
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Transfer failed");
        
        emit Withdrawal(msg.sender, amount);
    }

    /**
     * @dev Deposits funds to the player's balance
     */
    function deposit() external payable {
        _balances[msg.sender] += msg.value;
        emit Deposit(msg.sender, msg.value);
    }

    /**
     * @dev Returns the balance of a player
     * @param player The address of the player
     * @return The balance of the player
     */
    function balanceOf(address player) external view returns (uint256) {
        return _balances[player];
    }

    /**
     * @dev Returns a game by ID
     * @param gameId The ID of the game
     * @return The game
     */
    function getGame(uint256 gameId) external view returns (Game memory) {
        return _games[gameId];
    }

    /**
     * @dev Pauses the contract
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @dev Unpauses the contract
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @dev Withdraws funds from the contract in case of emergency
     * @param amount The amount to withdraw
     */
    function emergencyWithdraw(uint256 amount) external onlyOwner {
        require(amount <= address(this).balance, "Insufficient contract balance");
        
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Transfer failed");
    }
} 