// SPDX-License-Identifier: MIT
pragma solidity ^0.7.6;
pragma abicoder v2;

/*
@title The manager contract interface for multiple markets and the pools in them
*/
interface IPoolKeeper {
  // #### Functions
  /**
    @notice Checks for a price update for the pools specified. Several pools can be updated with a single call to the oracle. For instance, a market code of TSLA/USD+aDAI can be used to update TSLA/USD^2+aDAI, TSLA/USD^5+aDAI, and TSLA/USD^10+aDAI
    @dev This should remain open. It should only cause a change in the pools if the price has actually changed. 
    @param marketCode The market to get a quote for. Should be in the format BASE/QUOTE-DIGITAL_ASSET, eg TSLA/USD+aDAI
   */
  function triggerPriceUpdate(
    string memory marketCode,
    string[] memory poolCodes
  ) external;

  /**
    @notice Updates the address of the oracle wrapper.
    @dev Should be restricted to authorised users with access controls
    @param oracle The new OracleWrapper to use
    */
  function updateOracleWrapper(address oracle) external;

  /**
    @notice Creates a new market and sets the oracle to use for it.
    @dev This cannot be used to update a market's oracle, and will revert if attempted
    @param marketCode The market code to identify this market
 */
  function createMarket(string memory marketCode, address oracle) external;

  /**
    @notice Creates a new pool in a given market
    @dev Should throw an error if the market code is invalid/doesn't exist. 
    @param marketCode The market to create the pool in. The current price will be read and used to set the pool's lastPrice field.
    @param poolCode The pool's identifier
    @param updateInterval The minimum amount of time that must elapse before a price update can occur. If the interval is 5 minutes, then the price cannot be updated until 5 minutes after the last update has elapsed.
    @param frontRunningInterval The amount of time that must elapse between a commit and the next update interval before a commit can be executed. Must be shorter than the update interval to prevent deadlock.
    @param fee The percentage fee that will be charged to the pool's capital on a successful price update
    @param leverageAmount The leverage that the pool will expose it's depositors to
    @param feeAddress The address that fees will be sent to on every price change
    @param quoteToken The address of the digital asset that this pool contains
   */
  function createPool(
    string memory marketCode,
    string memory poolCode,
    uint32 updateInterval,
    uint32 frontRunningInterval,
    uint16 fee,
    uint16 leverageAmount,
    address feeAddress,
    address quoteToken
  ) external;
}
