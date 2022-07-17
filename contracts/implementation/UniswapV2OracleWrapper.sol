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

    bool public reversed;
    uint256 public priceAverageWad;
    uint256 public priceCumulativeLast;
    uint32 public blockTimestampLast;

    // #### Functions
    constructor(address _oracle, address _deployer) {
        require(_oracle != address(0), "Oracle cannot be null");
        require(_deployer != address(0), "Deployer cannot be null");
        oracle = _oracle;
        deployer = _deployer;
        // initialize the prices
        (uint112 reserve0, uint112 reserve1, uint32 blockTimestamp) = IUniswapV2Pair(oracle).getReserves();
        reversed = (reserve0 > reserve1);
        priceAverageWad = reversed ? (_fromWad(reserve0)) / reserve1 : (_fromWad(reserve1)) / reserve0;
        priceCumulativeLast = _priceCumulativeLast();
        blockTimestampLast = blockTimestamp;
    }

    function decimals() external pure override returns (uint8) {
        return DECIMALS;
    }

    /**
     * @notice Returns the oracle price in WAD format
     */
    function getPrice() external view override returns (int256) {
        return int256(priceAverageWad);
    }

    /**
     * @return _price The latest round data price
     * @return _data The metadata. Implementations can choose what data to return here. This implementation returns the blockTimestampLast
     */
    function getPriceAndMetadata() external view override returns (int256, bytes memory) {
        return (int256(priceAverageWad), abi.encodePacked(uint80(blockTimestampLast)));
    }

    /**
     * @notice Converts from a WAD value to a raw value based on the decimals in the feed
     */
    function fromWad(int256 wad) external pure override returns (int256) {
        return wad * int256(10**DECIMALS);
    }

    function _fromWad(uint256 wad) internal pure returns (uint256) {
        return wad * (10**DECIMALS);
    }

    function _priceCumulativeLast() internal view returns (uint256) {
        if (!reversed) {
            return IUniswapV2Pair(oracle).price0CumulativeLast();
        } else {
            return IUniswapV2Pair(oracle).price1CumulativeLast();
        }
    }

    function poll() external override returns (int256) {
        (, , uint32 blockTimestamp) = IUniswapV2Pair(oracle).getReserves();
        if (blockTimestamp > blockTimestampLast) {
            uint256 priceCumulative = _priceCumulativeLast();
            // update the price average
            priceAverageWad = _fromWad(priceCumulative - priceCumulativeLast);
            priceAverageWad /= (blockTimestamp - blockTimestampLast);
            priceAverageWad >>= 112;
            // update other globals
            priceCumulativeLast = priceCumulative;
            blockTimestampLast = blockTimestamp;
        }
        return int256(priceAverageWad);
    }
}
