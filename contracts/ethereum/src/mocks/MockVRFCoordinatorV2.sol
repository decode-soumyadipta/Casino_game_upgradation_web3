// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";

/**
 * @title MockVRFCoordinatorV2
 * @dev Mock contract for testing VRF functionality
 */
contract MockVRFCoordinatorV2 is VRFCoordinatorV2Interface {
    uint256 private nextRequestId = 1;
    
    struct Request {
        address requester;
        uint256 requestId;
        bytes32 keyHash;
        uint64 subId;
        uint32 callbackGasLimit;
        uint16 requestConfirmations;
        uint32 numWords;
    }
    
    mapping(uint256 => Request) private s_requests;
    
    /**
     * @dev Mocks the requestRandomWords function of the VRF Coordinator
     */
    function requestRandomWords(
        bytes32 keyHash,
        uint64 subId,
        uint16 requestConfirmations,
        uint32 callbackGasLimit,
        uint32 numWords
    ) external override returns (uint256) {
        uint256 requestId = nextRequestId;
        nextRequestId++;
        
        s_requests[requestId] = Request({
            requester: msg.sender,
            requestId: requestId,
            keyHash: keyHash,
            subId: subId,
            callbackGasLimit: callbackGasLimit,
            requestConfirmations: requestConfirmations,
            numWords: numWords
        });
        
        return requestId;
    }
    
    /**
     * @dev Mocks the fulfillRandomWords function to simulate Chainlink VRF callback
     * @param requestId The ID of the request to fulfill
     * @param consumer The address of the consumer contract
     * @param randomWords The random values to return
     */
    function fulfillRandomWords(
        uint256 requestId,
        address consumer,
        uint256[] memory randomWords
    ) external {
        Request memory request = s_requests[requestId];
        require(request.requester != address(0), "Request not found");
        
        VRFConsumerBaseV2(consumer).rawFulfillRandomWords(requestId, randomWords);
    }
    
    // The following functions are not used in testing but are required by the interface
    
    function getRequestConfig() external pure override returns (uint16, uint32, bytes32[] memory) {
        bytes32[] memory keyhashes = new bytes32[](0);
        return (3, 2000000, keyhashes);
    }
    
    function createSubscription() external pure override returns (uint64) {
        return 1;
    }
    
    function getSubscription(uint64) external pure override returns (
        uint96, uint64, address, address[] memory
    ) {
        address[] memory consumers = new address[](0);
        return (0, 0, address(0), consumers);
    }
    
    function requestSubscriptionOwnerTransfer(uint64, address) external pure override {
        // Not implemented
    }
    
    function acceptSubscriptionOwnerTransfer(uint64) external pure override {
        // Not implemented
    }
    
    function addConsumer(uint64, address) external pure override {
        // Not implemented
    }
    
    function removeConsumer(uint64, address) external pure override {
        // Not implemented
    }
    
    function cancelSubscription(uint64, address) external pure override {
        // Not implemented
    }
    
    function pendingRequestExists(uint64) external pure override returns (bool) {
        return false;
    }
} 