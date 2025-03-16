// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

/**
 * @title MockRandomnessProvider
 * @dev A mock implementation of the RandomnessProvider for testing purposes
 */
contract MockRandomnessProvider {
    uint256 private _mockRandomValue = 12345;

    /**
     * @dev Sets a predetermined random value for testing
     * @param value The random value to return
     */
    function setMockRandomValue(uint256 value) external {
        _mockRandomValue = value;
    }

    /**
     * @dev Returns the mock random value
     * @return The predetermined random value
     */
    function getRandomNumber() external view returns (uint256) {
        return _mockRandomValue;
    }

    /**
     * @dev Returns the owner address (for compatibility with the real contract)
     */
    function owner() external pure returns (address) {
        return address(0x1);
    }
} 