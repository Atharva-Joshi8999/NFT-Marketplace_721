// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ERC721} from "lib/openzeppelin-contracts/contracts/token/ERC721/ERC721.sol";
import {ERC721URIStorage} from "lib/openzeppelin-contracts/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import {Ownable} from "lib/openzeppelin-contracts/contracts/access/Ownable.sol";

contract ERC_721_Marketplace is ERC721, ERC721URIStorage, Ownable {
    uint256 private _nextTokenId;
    uint256[] private _listedTokenIds;

    struct Listing {
        address seller;
        uint256 price;
    }

    mapping(uint256 => Listing) public listings;

    event NFT_Minted(uint256 indexed tokenId, address indexed owner, string uri);
    event NFT_Listed(uint256 indexed tokenId, address indexed seller, uint256 price);
    event NFTPurchased(uint256 indexed tokenId, address indexed buyer, uint256 price);
    event ListingCancelled(uint256 indexed tokenId);

    constructor() ERC721("ERC721Marketplace", "ERC721MKT") Ownable(msg.sender) {}

    function listing(uint256 tokenId, uint256 price) external {
        require(ownerOf(tokenId) == msg.sender, "Not the owner");
        require(price > 0, "Price must be greater than zero");
        listings[tokenId] = Listing(msg.sender, price);
        _listedTokenIds.push(tokenId);
        emit NFT_Listed(tokenId, msg.sender, price);
    }

    function removeTokenFromListed(uint256 tokenId) internal {
        for (uint256 i = 0; i < _listedTokenIds.length; i++) {
            if (_listedTokenIds[i] == tokenId) {
                _listedTokenIds[i] = _listedTokenIds[_listedTokenIds.length - 1];
                _listedTokenIds.pop(); 
                break;
            }
        }
    }

    function buyNFT(uint256 tokenId) external payable {
        Listing memory item = listings[tokenId]; 
        require(item.price > 0, "NFT not listed");
        require(msg.value >= item.price, "Not enough ETH sent");

        delete listings[tokenId];
        removeTokenFromListed(tokenId);
        payable(item.seller).transfer(item.price);
        _transfer(item.seller, msg.sender, tokenId);

        emit NFTPurchased(tokenId, msg.sender, item.price);
    }

    function cancelListing(uint256 tokenId) external {
        Listing memory item = listings[tokenId]; 
        require(item.seller == msg.sender, "Not the seller");

        delete listings[tokenId];
        removeTokenFromListed(tokenId);
        emit ListingCancelled(tokenId);
    }

    function getAllListings() external view returns (Listing[] memory, uint256[] memory) {
        uint256 count = _listedTokenIds.length; 
        Listing[] memory activeListings = new Listing[](count);
        uint256[] memory tokenIds = new uint256[](count);

        for (uint i = 0; i < count; i++) {
            uint256 tokenId = _listedTokenIds[i];
            activeListings[i] = listings[tokenId];
            tokenIds[i] = tokenId;
        }

        return (activeListings, tokenIds);
    }

    function tokenURI(uint256 tokenId) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721, ERC721URIStorage) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
