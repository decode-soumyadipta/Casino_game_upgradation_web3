// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../RandomnessProvider.sol";

/**
 * @title MockVRFCoordinator
 * @dev Mock contract for testing the RandomnessProvider contract
 */
contract MockVRFCoordinator {
    uint256 private requestIdToReturn;

    /**
     * @dev Sets the request ID to return for the next requestRandomness call
     * @param _requestId The request ID to return
     */
    function setRequestId(uint256 _requestId) external {
        requestIdToReturn = _requestId;
    }

    /**
     * @dev Mock implementation of the VRF Coordinator's requestRandomWords function
     * @return requestId The mocked request ID
     */
    function requestRandomWords(
        bytes32 /*keyHash*/,
        uint64 /*subscriptionId*/,
        uint16 /*minimumRequestConfirmations*/,
        uint32 /*callbackGasLimit*/,
        uint32 /*numWords*/
    ) external returns (uint256 requestId) {
        return requestIdToReturn;
    }

    /**
     * @dev Simulates the VRF Coordinator fulfilling a randomness request
     * @param requestId The request ID to fulfill
     * @param consumerAddress The address of the consumer contract
     * @param randomWords The random words to return
     */
    function fulfillRandomWords(
        uint256 requestId,
        address consumerAddress,
        uint256[] memory randomWords
    ) external {
        VRFConsumerBaseV2(consumerAddress).rawFulfillRandomWords(requestId, randomWords);
    }
}

/**
 * @dev Interface for the VRFConsumerBaseV2 contract
 */
interface VRFConsumerBaseV2 {
    function rawFulfillRandomWords(uint256 requestId, uint256[] memory randomWords) external;
} 