// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import {ERC721} from "lib/openzeppelin-contracts/contracts/token/ERC721/ERC721.sol";
import {ERC721URIStorage} from "lib/openzeppelin-contracts/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import {ERC721Enumerable} from "lib/openzeppelin-contracts/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import {Ownable} from "lib/openzeppelin-contracts/contracts/access/Ownable.sol";

/**
 * @title ERC721 Marketplace
 * @author Atharva Joshi
 * @notice This smart contract implements an ERC721 NFT Marketplace where users can mint, list, buy, and cancel NFTs.
 * @dev Uses OpenZeppelin ERC721, ERC721URIStorage, ERC721Enumerable, and Ownable for NFT functionality and access control.
 */
contract ERC721Marketplace is ERC721, ERC721URIStorage, ERC721Enumerable, Ownable {
    uint256 private _nextTokenId;
    uint256[] private _listedTokenIds;

    struct Listing {
        address seller;
        uint256 price;
    }

    mapping(uint256 => Listing) public listings;

    event NFTMinted(uint256 indexed tokenId, address indexed owner, string uri);
    event NFTListed(uint256 indexed tokenId, address indexed seller, uint256 price);
    event NFTPurchased(uint256 indexed tokenId, address indexed buyer, uint256 price);
    event ListingCancelled(uint256 indexed tokenId);

    constructor() ERC721("ERC721Marketplace", "MARKET") Ownable(msg.sender) {}

    function mintNFT(string memory uri) public returns (uint256) {
        uint256 newItemId = _nextTokenId;
        _mint(msg.sender, newItemId);
        _setTokenURI(newItemId, uri);
        _nextTokenId++;
        emit NFTMinted(newItemId, msg.sender, uri);
        return newItemId;
    }

    function listing(uint256 tokenId, uint256 price) external {
        require(ownerOf(tokenId) == msg.sender, "Not the owner");
        require(price > 0, "Price must be > 0");
        require(listings[tokenId].seller == address(0), "Already listed");

        // Check approval - the marketplace contract needs approval to transfer
        require(
            getApproved(tokenId) == address(this) || isApprovedForAll(msg.sender, address(this)),
            "Marketplace not approved to transfer this NFT"
        );

        listings[tokenId] = Listing(msg.sender, price);
        _listedTokenIds.push(tokenId);
        emit NFTListed(tokenId, msg.sender, price);
    }

    function buyNFT(uint256 tokenId) external payable {
        Listing memory item = listings[tokenId];
        require(item.price > 0, "NFT not listed for sale");
        require(msg.value >= item.price, "Insufficient payment");
        require(item.seller != msg.sender, "Cannot buy your own NFT");

        address seller = item.seller;
        uint256 price = item.price;

        // Verify ownership and approval before proceeding
        require(ownerOf(tokenId) == seller, "Seller no longer owns this NFT");
        require(
            getApproved(tokenId) == address(this) || isApprovedForAll(seller, address(this)),
            "Marketplace not approved to transfer NFT"
        );

        // Clear listing BEFORE transfer to prevent reentrancy
        delete listings[tokenId];
        _removeFromListedTokenIds(tokenId);

        // Transfer NFT from seller to buyer
        _safeTransfer(seller, msg.sender, tokenId, "");

        // Transfer payment to seller
        (bool success,) = payable(seller).call{value: price}("");
        require(success, "Payment transfer failed");

        // Refund excess payment if any
        if (msg.value > price) {
            (bool refundSuccess,) = payable(msg.sender).call{value: msg.value - price}("");
            require(refundSuccess, "Refund failed");
        }

        emit NFTPurchased(tokenId, msg.sender, price);
    }

    function cancelListing(uint256 tokenId) external {
        Listing memory item = listings[tokenId];
        require(item.seller == msg.sender || msg.sender == owner(), "Not authorized");
        require(item.price > 0, "NFT not listed");

        delete listings[tokenId];
        _removeFromListedTokenIds(tokenId);
        emit ListingCancelled(tokenId);
    }

    function _removeFromListedTokenIds(uint256 tokenId) internal {
        for (uint256 i = 0; i < _listedTokenIds.length; i++) {
            if (_listedTokenIds[i] == tokenId) {
                _listedTokenIds[i] = _listedTokenIds[_listedTokenIds.length - 1];
                _listedTokenIds.pop();
                break;
            }
        }
    }

    function getAllListings() external view returns (Listing[] memory, uint256[] memory) {
        uint256 validListingCount = 0;

        // First pass: count valid listings
        for (uint256 i = 0; i < _listedTokenIds.length; i++) {
            uint256 tokenId = _listedTokenIds[i];
            if (listings[tokenId].price > 0) {
                validListingCount++;
            }
        }

        // Second pass: populate arrays with valid listings
        Listing[] memory validListings = new Listing[](validListingCount);
        uint256[] memory validTokenIds = new uint256[](validListingCount);
        uint256 currentIndex = 0;

        for (uint256 i = 0; i < _listedTokenIds.length; i++) {
            uint256 tokenId = _listedTokenIds[i];
            if (listings[tokenId].price > 0) {
                validListings[currentIndex] = listings[tokenId];
                validTokenIds[currentIndex] = tokenId;
                currentIndex++;
            }
        }

        return (validListings, validTokenIds);
    }

    // Use ERC721Enumerable for better NFT tracking
    function tokensOfOwner(address owner) external view returns (uint256[] memory) {
        uint256 tokenCount = balanceOf(owner);
        uint256[] memory tokenIds = new uint256[](tokenCount);

        for (uint256 i = 0; i < tokenCount; i++) {
            tokenIds[i] = tokenOfOwnerByIndex(owner, i);
        }

        return tokenIds;
    }

    function getListingInfo(uint256 tokenId) external view returns (bool isListed, address seller, uint256 price) {
        Listing memory listing = listings[tokenId];
        return (listing.price > 0, listing.seller, listing.price);
    }

    function getTotalSupply() external view returns (uint256) {
        return totalSupply();
    }

    function getNextTokenId() external view returns (uint256) {
        return _nextTokenId;
    }

    // Required overrides
    function tokenURI(uint256 tokenId) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721URIStorage, ERC721Enumerable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    function _update(address to, uint256 tokenId, address auth)
        internal
        override(ERC721, ERC721Enumerable)
        returns (address)
    {
        return super._update(to, tokenId, auth);
    }

    function _increaseBalance(address account, uint128 value) internal override(ERC721, ERC721Enumerable) {
        super._increaseBalance(account, value);
    }
}
