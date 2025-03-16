// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

interface VRFConsumerBaseV2 {
    function rawFulfillRandomWords(uint256 requestId, uint256[] memory randomWords) external;
}

contract MockVRFCoordinator {
    uint256 private s_nextRequestId = 1;

    function setRequestId(uint256 requestId) external {
        s_nextRequestId = requestId;
    }

    function requestRandomWords(
        bytes32 keyHash,
        uint64 subId,
        uint16 minimumRequestConfirmations,
        uint32 callbackGasLimit,
        uint32 numWords
    ) external returns (uint256) {
        return s_nextRequestId;
    }

    function fulfillRandomWords(
        uint256 requestId,
        address consumer,
        uint256[] memory randomWords
    ) external {
        VRFConsumerBaseV2(consumer).rawFulfillRandomWords(requestId, randomWords);
    }
} 