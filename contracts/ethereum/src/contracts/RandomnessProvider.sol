// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";
import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";

/**
 * @title RandomnessProvider
 * @dev Contract for providing verifiable randomness for casino games using Chainlink VRF
 */
contract RandomnessProvider is VRFConsumerBaseV2, Ownable {
    // Chainlink VRF variables
    VRFCoordinatorV2Interface private immutable COORDINATOR;
    uint64 private immutable s_subscriptionId;
    bytes32 private immutable s_keyHash;
    uint32 private immutable s_callbackGasLimit;
    uint16 private constant REQUEST_CONFIRMATIONS = 3;
    uint32 private constant NUM_WORDS = 1;
    
    // Mapping from requestId to gameId
    mapping(uint256 => bytes32) private s_requests;
    // Mapping from gameId to random number
    mapping(bytes32 => uint256) private s_results;
    // Mapping from gameId to request status
    mapping(bytes32 => bool) private s_fulfilled;
    
    // Events
    event RandomnessRequested(bytes32 indexed gameId, uint256 requestId);
    event RandomnessFulfilled(bytes32 indexed gameId, uint256 randomNumber);
    
    /**
     * @dev Constructor to initialize the contract
     * @param _vrfCoordinator Address of the VRF Coordinator
     * @param _subscriptionId Chainlink VRF subscription ID
     * @param _keyHash Gas lane key hash
     * @param _callbackGasLimit Gas limit for the callback
     */
    constructor(
        address _vrfCoordinator,
        uint64 _subscriptionId,
        bytes32 _keyHash,
        uint32 _callbackGasLimit
    ) VRFConsumerBaseV2(_vrfCoordinator) {
        COORDINATOR = VRFCoordinatorV2Interface(_vrfCoordinator);
        s_subscriptionId = _subscriptionId;
        s_keyHash = _keyHash;
        s_callbackGasLimit = _callbackGasLimit;
    }
    
    /**
     * @dev Requests randomness for a game
     * @param _gameId Unique identifier for the game
     * @return requestId The ID of the randomness request
     */
    function requestRandomness(bytes32 _gameId) external onlyOwner returns (uint256 requestId) {
        require(!s_fulfilled[_gameId], "Randomness already requested for this game");
        
        // Request randomness from Chainlink VRF
        requestId = COORDINATOR.requestRandomWords(
            s_keyHash,
            s_subscriptionId,
            REQUEST_CONFIRMATIONS,
            s_callbackGasLimit,
            NUM_WORDS
        );
        
        s_requests[requestId] = _gameId;
        
        emit RandomnessRequested(_gameId, requestId);
        
        return requestId;
    }
    
    /**
     * @dev Callback function used by VRF Coordinator to return the random number
     * @param _requestId The ID of the randomness request
     * @param _randomWords The random result returned by the VRF Coordinator
     */
    function fulfillRandomWords(uint256 _requestId, uint256[] memory _randomWords) internal override {
        bytes32 gameId = s_requests[_requestId];
        require(gameId != bytes32(0), "Request not found");
        
        uint256 randomNumber = _randomWords[0];
        s_results[gameId] = randomNumber;
        s_fulfilled[gameId] = true;
        
        emit RandomnessFulfilled(gameId, randomNumber);
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