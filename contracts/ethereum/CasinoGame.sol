// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

/**
 * @title CasinoGame
 * @dev Main contract for the casino game platform
 * @notice This contract handles user balances, deposits, withdrawals, and game results
 */
contract CasinoGame is Ownable, ReentrancyGuard, Pausable {
    using SafeMath for uint256;

    // Events
    event Deposit(address indexed user, uint256 amount);
    event Withdrawal(address indexed user, uint256 amount);
    event GamePlayed(address indexed user, bytes32 gameId, uint256 betAmount, uint256 winAmount, bool isWin);
    event GameResultVerified(bytes32 indexed gameId, bytes32 resultHash);
    event OperatorAdded(address indexed operator);
    event OperatorRemoved(address indexed operator);
    event HouseEdgeUpdated(uint256 oldEdge, uint256 newEdge);
    event MinBetUpdated(uint256 oldMinBet, uint256 newMinBet);
    event MaxBetUpdated(uint256 oldMaxBet, uint256 newMaxBet);

    // Structs
    struct Game {
        address player;
        uint256 betAmount;
        uint256 winAmount;
        bool isSettled;
        bool isWin;
        uint256 timestamp;
    }

    // State variables
    mapping(address => uint256) private userBalances;
    mapping(bytes32 => Game) private games;
    mapping(address => bool) private operators;
    
    uint256 public houseEdge; // Represented as basis points (e.g., 250 = 2.5%)
    uint256 public minBet;
    uint256 public maxBet;
    uint256 public totalBets;
    uint256 public totalWinnings;
    
    // Constants
    uint256 private constant BASIS_POINTS = 10000; // 100%
    uint256 private constant MAX_HOUSE_EDGE = 1000; // 10% max house edge
    
    /**
     * @dev Constructor to initialize the contract
     * @param _houseEdge Initial house edge in basis points (e.g., 250 = 2.5%)
     * @param _minBet Minimum bet amount in wei
     * @param _maxBet Maximum bet amount in wei
     */
    constructor(uint256 _houseEdge, uint256 _minBet, uint256 _maxBet) {
        require(_houseEdge <= MAX_HOUSE_EDGE, "House edge too high");
        require(_minBet > 0, "Min bet must be greater than 0");
        require(_maxBet > _minBet, "Max bet must be greater than min bet");
        
        houseEdge = _houseEdge;
        minBet = _minBet;
        maxBet = _maxBet;
        
        // Add contract deployer as an operator
        operators[msg.sender] = true;
        emit OperatorAdded(msg.sender);
    }
    
    // Modifiers
    
    /**
     * @dev Modifier to restrict function access to operators only
     */
    modifier onlyOperator() {
        require(operators[msg.sender] || owner() == msg.sender, "Not an operator");
        _;
    }
    
    /**
     * @dev Modifier to check if a bet amount is valid
     * @param _amount Bet amount to check
     */
    modifier validBet(uint256 _amount) {
        require(_amount >= minBet, "Bet below minimum");
        require(_amount <= maxBet, "Bet above maximum");
        _;
    }
    
    // External/Public functions
    
    /**
     * @dev Allows users to deposit ETH into their casino balance
     */
    function deposit() external payable whenNotPaused nonReentrant {
        require(msg.value > 0, "Deposit amount must be greater than 0");
        
        userBalances[msg.sender] = userBalances[msg.sender].add(msg.value);
        
        emit Deposit(msg.sender, msg.value);
    }
    
    /**
     * @dev Allows users to withdraw ETH from their casino balance
     * @param _amount Amount to withdraw
     */
    function withdraw(uint256 _amount) external nonReentrant {
        require(_amount > 0, "Withdrawal amount must be greater than 0");
        require(userBalances[msg.sender] >= _amount, "Insufficient balance");
        
        userBalances[msg.sender] = userBalances[msg.sender].sub(_amount);
        
        (bool success, ) = msg.sender.call{value: _amount}("");
        require(success, "Transfer failed");
        
        emit Withdrawal(msg.sender, _amount);
    }
    
    /**
     * @dev Places a bet for a game
     * @param _gameId Unique identifier for the game
     * @param _betAmount Amount to bet
     * @return success Whether the bet was placed successfully
     */
    function placeBet(bytes32 _gameId, uint256 _betAmount) 
        external 
        whenNotPaused 
        nonReentrant 
        validBet(_betAmount) 
        returns (bool success) 
    {
        require(games[_gameId].player == address(0), "Game already exists");
        require(userBalances[msg.sender] >= _betAmount, "Insufficient balance");
        
        // Deduct bet amount from user balance
        userBalances[msg.sender] = userBalances[msg.sender].sub(_betAmount);
        
        // Create new game record
        games[_gameId] = Game({
            player: msg.sender,
            betAmount: _betAmount,
            winAmount: 0,
            isSettled: false,
            isWin: false,
            timestamp: block.timestamp
        });
        
        totalBets = totalBets.add(_betAmount);
        
        return true;
    }
    
    /**
     * @dev Settles a game result (can only be called by an operator)
     * @param _gameId Unique identifier for the game
     * @param _isWin Whether the player won
     * @param _winAmount Amount won by the player (0 if lost)
     * @param _resultHash Hash of the game result for verification
     */
    function settleGame(
        bytes32 _gameId, 
        bool _isWin, 
        uint256 _winAmount, 
        bytes32 _resultHash
    ) 
        external 
        onlyOperator 
        nonReentrant 
    {
        Game storage game = games[_gameId];
        
        require(game.player != address(0), "Game does not exist");
        require(!game.isSettled, "Game already settled");
        
        // If player won, validate win amount and add to their balance
        if (_isWin) {
            // Calculate maximum possible win based on bet amount and house edge
            uint256 maxPossibleWin = game.betAmount.mul(BASIS_POINTS).div(BASIS_POINTS.sub(houseEdge));
            require(_winAmount <= maxPossibleWin, "Win amount too high");
            
            userBalances[game.player] = userBalances[game.player].add(_winAmount);
            totalWinnings = totalWinnings.add(_winAmount);
        }
        
        // Update game record
        game.isSettled = true;
        game.isWin = _isWin;
        game.winAmount = _winAmount;
        
        emit GamePlayed(game.player, _gameId, game.betAmount, _winAmount, _isWin);
        emit GameResultVerified(_gameId, _resultHash);
    }
    
    /**
     * @dev Gets a user's balance
     * @param _user Address of the user
     * @return balance User's balance
     */
    function balanceOf(address _user) external view returns (uint256 balance) {
        return userBalances[_user];
    }
    
    /**
     * @dev Gets details of a game
     * @param _gameId Unique identifier for the game
     * @return player Address of the player
     * @return betAmount Amount bet
     * @return winAmount Amount won
     * @return isSettled Whether the game has been settled
     * @return isWin Whether the player won
     * @return timestamp Time when the game was created
     */
    function getGame(bytes32 _gameId) 
        external 
        view 
        returns (
            address player,
            uint256 betAmount,
            uint256 winAmount,
            bool isSettled,
            bool isWin,
            uint256 timestamp
        ) 
    {
        Game memory game = games[_gameId];
        return (
            game.player,
            game.betAmount,
            game.winAmount,
            game.isSettled,
            game.isWin,
            game.timestamp
        );
    }
    
    /**
     * @dev Checks if an address is an operator
     * @param _operator Address to check
     * @return isOperator Whether the address is an operator
     */
    function isOperator(address _operator) external view returns (bool) {
        return operators[_operator];
    }
    
    // Admin functions
    
    /**
     * @dev Adds a new operator (can only be called by the owner)
     * @param _operator Address of the new operator
     */
    function addOperator(address _operator) external onlyOwner {
        require(_operator != address(0), "Invalid operator address");
        require(!operators[_operator], "Already an operator");
        
        operators[_operator] = true;
        emit OperatorAdded(_operator);
    }
    
    /**
     * @dev Removes an operator (can only be called by the owner)
     * @param _operator Address of the operator to remove
     */
    function removeOperator(address _operator) external onlyOwner {
        require(operators[_operator], "Not an operator");
        
        operators[_operator] = false;
        emit OperatorRemoved(_operator);
    }
    
    /**
     * @dev Updates the house edge (can only be called by the owner)
     * @param _newHouseEdge New house edge in basis points
     */
    function updateHouseEdge(uint256 _newHouseEdge) external onlyOwner {
        require(_newHouseEdge <= MAX_HOUSE_EDGE, "House edge too high");
        
        uint256 oldHouseEdge = houseEdge;
        houseEdge = _newHouseEdge;
        
        emit HouseEdgeUpdated(oldHouseEdge, _newHouseEdge);
    }
    
    /**
     * @dev Updates the minimum bet amount (can only be called by the owner)
     * @param _newMinBet New minimum bet amount
     */
    function updateMinBet(uint256 _newMinBet) external onlyOwner {
        require(_newMinBet > 0, "Min bet must be greater than 0");
        require(_newMinBet < maxBet, "Min bet must be less than max bet");
        
        uint256 oldMinBet = minBet;
        minBet = _newMinBet;
        
        emit MinBetUpdated(oldMinBet, _newMinBet);
    }
    
    /**
     * @dev Updates the maximum bet amount (can only be called by the owner)
     * @param _newMaxBet New maximum bet amount
     */
    function updateMaxBet(uint256 _newMaxBet) external onlyOwner {
        require(_newMaxBet > minBet, "Max bet must be greater than min bet");
        
        uint256 oldMaxBet = maxBet;
        maxBet = _newMaxBet;
        
        emit MaxBetUpdated(oldMaxBet, _newMaxBet);
    }
    
    /**
     * @dev Pauses the contract (can only be called by the owner)
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    /**
     * @dev Unpauses the contract (can only be called by the owner)
     */
    function unpause() external onlyOwner {
        _unpause();
    }
    
    /**
     * @dev Allows the owner to withdraw funds in case of emergency
     * @param _amount Amount to withdraw
     */
    function emergencyWithdraw(uint256 _amount) external onlyOwner {
        require(_amount <= address(this).balance, "Insufficient contract balance");
        
        (bool success, ) = owner().call{value: _amount}("");
        require(success, "Transfer failed");
    }
} 