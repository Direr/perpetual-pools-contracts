//SPDX-License-Identifier: CC-BY-NC-ND-4.0
pragma solidity 0.8.7;

import "../interfaces/IOracleWrapper.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol";

/// @title The oracle management contract for uniswap V2 oracles
contract UniswapV2OracleWrapper is IOracleWrapper {
    // #### Globals
    /**
     * @notice The address of the feed oracle
     */
    address public override oracle;
    address public immutable override deployer;
    uint8 private constant DECIMALS = 18;

    // #### Functions
    constructor(address _oracle, address _deployer) {
        require(_oracle != address(0), "Oracle cannot be null");
        require(_deployer != address(0), "Deployer cannot be null");
        oracle = _oracle;
        deployer = _deployer;
    }

    function decimals() external pure override returns (uint8) {
        return DECIMALS;
    }

    /**
     * @notice Returns the oracle price in WAD format
     */
    function getPrice() external view override returns (int256) {
        (int256 _price, ) = _latestRoundData();
        return _price;
    }

    /**
     * @return _price The latest round data price
     * @return _data The metadata. Implementations can choose what data to return here. This implementation returns the blockTimestamp
     */
    function getPriceAndMetadata() external view override returns (int256, bytes memory) {
        (int256 price, uint80 roundID) = _latestRoundData();
        bytes memory _data = abi.encodePacked(roundID);
        return (price, _data);
    }

    function _latestRoundData() internal view returns (int256, uint80) {
        (uint112 reserve0, uint112 reserve1, uint32 blockTimestamp) = IUniswapV2Pair(oracle).getReserves();
        if (reserve0 > reserve1) {
            return (int256((reserve0 * (10**DECIMALS)) / reserve1), uint80(blockTimestamp));
        } else {
            return (int256((reserve1 * (10**DECIMALS)) / reserve0), uint80(blockTimestamp));
        }
    }

    /**
     * @notice Converts from a WAD value to a raw value based on the decimals in the feed
     */
    function fromWad(int256 wad) external pure override returns (int256) {
        return wad * int256(10**DECIMALS);
    }

    function poll() external pure override returns (int256) {
        return 0;
    }
}
