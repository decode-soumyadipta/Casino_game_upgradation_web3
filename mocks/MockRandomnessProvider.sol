// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

/**
 * @title MockRandomnessProvider
 * @dev A mock implementation of the RandomnessProvider contract for testing
 */
contract MockRandomnessProvider {
    // Mapping from gameId to random number
    mapping(uint256 => uint256) private randomNumbers;
    
    // Mapping from gameId to availability status
    mapping(uint256 => bool) private randomnessAvailable;
    
    /**
     * @dev Requests randomness for a game
     * @param gameId The ID of the game to request randomness for
     * @return requestId The ID of the randomness request (always returns 1 in mock)
     */
    function requestRandomness(uint256 gameId) external returns (uint256 requestId) {
        // In the mock, we just return a fixed requestId
        return 1;
    }
    
    /**
     * @dev Checks if randomness is available for a game
     * @param gameId The ID of the game to check
     * @return True if randomness is available, false otherwise
     */
    function isRandomnessAvailable(uint256 gameId) external view returns (bool) {
        return randomnessAvailable[gameId];
    }
    
    /**
     * @dev Gets the random number for a game
     * @param gameId The ID of the game to get randomness for
     * @return The random number
     */
    function getRandomNumber(uint256 gameId) external view returns (uint256) {
        require(randomnessAvailable[gameId], "Randomness not available");
        return randomNumbers[gameId];
    }
    
    /**
     * @dev Fulfills randomness for a game (test helper function)
     * @param gameId The ID of the game to fulfill randomness for
     * @param randomNumber The random number to set
     */
    function fulfillRandomness(uint256 gameId, uint256 randomNumber) external {
        randomNumbers[gameId] = randomNumber;
        randomnessAvailable[gameId] = true;
    }
} 