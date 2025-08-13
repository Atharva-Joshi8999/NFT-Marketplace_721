// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "forge-std/Script.sol";
import "../src/ERC_721_Marketplace.sol";

contract ERC_721_Deployment is Script {
    function run() external {
        vm.startBroadcast();
        new ERC721Marketplace();
        vm.stopBroadcast();
    }
}
