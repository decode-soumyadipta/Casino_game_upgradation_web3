// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

/**
 * @title MockVRFCoordinator
 * @dev Mock contract for Chainlink VRF Coordinator V2 for testing
 */
contract MockVRFCoordinator {
    uint256 private s_nextRequestId;
    
    // Interface for the VRF consumer callback
    interface VRFConsumerBaseV2 {
        function fulfillRandomWords(uint256 requestId, uint256[] memory randomWords) external;
    }
    
    /**
     * @dev Sets the next request ID to be returned
     * @param _requestId The request ID to return
     */
    function setRequestId(uint256 _requestId) external {
        s_nextRequestId = _requestId;
    }
    
    /**
     * @dev Mock implementation of requestRandomWords
     * @return requestId The ID of the randomness request
     */
    function requestRandomWords(
        bytes32 keyHash,
        uint64 subId,
        uint16 minimumRequestConfirmations,
        uint32 callbackGasLimit,
        uint32 numWords
    ) external returns (uint256 requestId) {
        return s_nextRequestId;
    }
    
    /**
     * @dev Simulates the VRF Coordinator fulfilling a randomness request
     * @param _requestId The ID of the randomness request
     * @param _consumer The address of the VRF consumer
     * @param _randomWords The random words to return
     */
    function fulfillRandomWords(
        uint256 _requestId,
        address _consumer,
        uint256[] memory _randomWords
    ) external {
        VRFConsumerBaseV2(_consumer).fulfillRandomWords(_requestId, _randomWords);
    }
} 