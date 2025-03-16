// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MockRandomnessProvider
 * @dev A mock implementation of the RandomnessProvider for testing purposes
 */
contract MockRandomnessProvider is Ownable {
    uint256 private _mockRandomValue = 12345;
    
    // Mapping from gameId to random number
    mapping(bytes32 => uint256) private s_results;
    // Mapping from gameId to request status
    mapping(bytes32 => bool) private s_fulfilled;
    
    // Events
    event RandomnessRequested(bytes32 indexed gameId, uint256 requestId);
    event RandomnessFulfilled(bytes32 indexed gameId, uint256 randomNumber);

    /**
     * @dev Sets a predetermined random value for testing
     * @param value The random value to return
     */
    function setMockRandomValue(uint256 value) external {
        _mockRandomValue = value;
    }

    /**
     * @dev Mocks the requestRandomness function of the real RandomnessProvider
     * @param _gameId Unique identifier for the game
     * @return requestId The ID of the randomness request (always 0 for mock)
     */
    function requestRandomness(bytes32 _gameId) external onlyOwner returns (uint256) {
        require(!s_fulfilled[_gameId], "Randomness already requested for this game");
        
        // Store the mock random value
        s_results[_gameId] = _mockRandomValue;
        s_fulfilled[_gameId] = true;
        
        // Emit events to simulate the real contract behavior
        emit RandomnessRequested(_gameId, 0);
        emit RandomnessFulfilled(_gameId, _mockRandomValue);
        
        return 0; // Mock request ID
    }
    
    /**
     * @dev Gets the random number for a game
     * @param _gameId Unique identifier for the game
     * @return randomNumber The random number
     * @return fulfilled Whether the randomness request has been fulfilled
     */
    function getRandomResult(bytes32 _gameId) external view returns (uint256 randomNumber, bool fulfilled) {
        return (s_results[_gameId], s_fulfilled[_gameId]);
    }
    
    /**
     * @dev Checks if randomness has been fulfilled for a game
     * @param _gameId Unique identifier for the game
     * @return fulfilled Whether the randomness request has been fulfilled
     */
    function isRandomnessFulfilled(bytes32 _gameId) external view returns (bool fulfilled) {
        return s_fulfilled[_gameId];
    }
} 