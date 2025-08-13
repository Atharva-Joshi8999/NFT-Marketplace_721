// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "forge-std/Test.sol";
import "../src/ERC_721_Marketplace.sol";

contract ERC721MarketplaceTest is Test {
    ERC721Marketplace market;
    address seller = address(0x1);
    address buyer = address(0x2);

    function setUp() public {
        vm.deal(seller, 10 ether);
        vm.deal(buyer, 10 ether);
        market = new ERC721Marketplace();
    }

    ///  Test Mint NFT
    function testMintNFT() public {
        vm.prank(seller);
        uint256 tokenId = market.mintNFT("ipfs://token1");
        assertEq(tokenId, 0);
        assertEq(market.ownerOf(tokenId), seller);
        assertEq(market.getNextTokenId(), 1);
    }

    ///  Test Listing NFT
    function testListNFT() public {
        vm.startPrank(seller);
        uint256 tokenId = market.mintNFT("ipfs://token1");
        market.approve(address(market), tokenId);
        market.listing(tokenId, 1 ether);
        (bool isListed,, uint256 price) = market.getListingInfo(tokenId);
        assertTrue(isListed);
        assertEq(price, 1 ether);
        vm.stopPrank();
    }

    ///  Test Buy NFT
    function testBuyNFT() public {
        vm.startPrank(seller);
        uint256 tokenId = market.mintNFT("ipfs://token1");
        market.approve(address(market), tokenId);
        market.listing(tokenId, 1 ether);
        vm.stopPrank();

        vm.prank(buyer);
        market.buyNFT{value: 1 ether}(tokenId);

        assertEq(market.ownerOf(tokenId), buyer);
        (bool isListed,,) = market.getListingInfo(tokenId);
        assertFalse(isListed);
    }

    ///  Test Cancel Listing by Seller
    function testCancelListingBySeller() public {
        vm.startPrank(seller);
        uint256 tokenId = market.mintNFT("ipfs://token1");
        market.approve(address(market), tokenId);
        market.listing(tokenId, 1 ether);
        market.cancelListing(tokenId);
        (bool isListed,,) = market.getListingInfo(tokenId);
        assertFalse(isListed);
        vm.stopPrank();
    }

    ///  Test Cancel Listing by Owner (contract owner)
    function testCancelListingByContractOwner() public {
        vm.startPrank(seller);
        uint256 tokenId = market.mintNFT("ipfs://token1");
        market.approve(address(market), tokenId);
        market.listing(tokenId, 1 ether);
        vm.stopPrank();

        vm.prank(market.owner());
        market.cancelListing(tokenId);
        (bool isListed,,) = market.getListingInfo(tokenId);
        assertFalse(isListed);
    }

    ///  Test Cannot List Without Approval
    function testCannotListWithoutApproval() public {
        vm.startPrank(seller);
        uint256 tokenId = market.mintNFT("ipfs://token1");
        vm.expectRevert("Marketplace not approved to transfer this NFT");
        market.listing(tokenId, 1 ether);
        vm.stopPrank();
    }

    ///  Test Get All Listings
    function testGetAllListings() public {
        vm.startPrank(seller);
        uint256 token1 = market.mintNFT("ipfs://token1");
        uint256 token2 = market.mintNFT("ipfs://token2");
        market.approve(address(market), token1);
        market.approve(address(market), token2);
        market.listing(token1, 1 ether);
        market.listing(token2, 2 ether);
        vm.stopPrank();

        (ERC721Marketplace.Listing[] memory listings, uint256[] memory ids) = market.getAllListings();
        assertEq(listings.length, 2);
        assertEq(ids.length, 2);
    }

    ///  Test Tokens Of Owner
    function testTokensOfOwner() public {
        vm.startPrank(seller);
        uint256 token1 = market.mintNFT("ipfs://token1");
        uint256 token2 = market.mintNFT("ipfs://token2");
        uint256[] memory tokens = market.tokensOfOwner(seller);
        assertEq(tokens.length, 2);
        assertEq(tokens[0], token1);
        assertEq(tokens[1], token2);
        vm.stopPrank();
    }

    ///  Test Get Total Supply
    function testGetTotalSupply() public {
        vm.startPrank(seller);
        market.mintNFT("ipfs://token1");
        market.mintNFT("ipfs://token2");
        vm.stopPrank();
        assertEq(market.getTotalSupply(), 2);
    }

    /// Test Refund Excess Payment
    function testRefundExcessPayment() public {
        vm.startPrank(seller);
        uint256 tokenId = market.mintNFT("ipfs://token1");
        market.approve(address(market), tokenId);
        market.listing(tokenId, 1 ether);
        vm.stopPrank();

        uint256 buyerBalanceBefore = buyer.balance;

        vm.prank(buyer);
        market.buyNFT{value: 2 ether}(tokenId); // Pay extra

        uint256 buyerBalanceAfter = buyer.balance;
        assertEq(buyerBalanceBefore - buyerBalanceAfter, 1 ether); // Only exact price spent
    }
}
