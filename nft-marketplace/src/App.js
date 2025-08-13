import { useState, useEffect } from "react";
import { ethers } from "ethers";
import axios from "axios";
import { CONTRACT_ADDRESS, CONTRACT_ABI } from "./contract";
import './App.css';

function App() {
  const [account, setAccount] = useState(null);
  const [contract, setContract] = useState(null);
  const [provider, setProvider] = useState(null);
  const [loading, setLoading] = useState(false);

  const [nftName, setNftName] = useState("");
  const [nftDescription, setNftDescription] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);

  const [listings, setListings] = useState([]);
  const [myNFTs, setMyNFTs] = useState([]);
  const [activeTab, setActiveTab] = useState("mint");

  const [showListingModal, setShowListingModal] = useState(false);
  const [selectedNFT, setSelectedNFT] = useState(null);
  const [listingPrice, setListingPrice] = useState("");

  // FIXED: Check MetaMask connection on app load without forcing connection
  useEffect(() => {
    const checkMetaMaskConnection = async () => {
      // Check if MetaMask is installed
      if (!window.ethereum) {
        console.log("MetaMask not installed");
        return;
      }

      try {
        // Check if already connected (but don't auto-connect)
        const accounts = await window.ethereum.request({ 
          method: 'eth_accounts' // This doesn't prompt user, just checks existing connections
        });
        
        if (accounts.length > 0) {
          console.log("Already connected to MetaMask");
          setAccount(accounts[0]);
          
          // Initialize provider and contract only if already connected
          const provider = new ethers.BrowserProvider(window.ethereum);
          setProvider(provider);
          const signer = await provider.getSigner();
          const contractInstance = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
          setContract(contractInstance);
        }
      } catch (error) {
        // Silently handle the error - don't show alert on initial load
        console.log("MetaMask connection check failed:", error.message);
      }
    };

    // Only check connection, don't auto-connect
    checkMetaMaskConnection();
  }, []); // Run only once on component mount

  // IMPROVED: Connect Wallet with better error handling
  const connectWallet = async () => {
    if (!window.ethereum) {
      alert("Please install MetaMask!");
      return;
    }
    
    try {
      setLoading(true);
      
      // Request account access
      const accounts = await window.ethereum.request({ 
        method: "eth_requestAccounts" 
      });
      
      if (accounts.length === 0) {
        throw new Error("No accounts found");
      }
      
      setAccount(accounts[0]);
      
      const provider = new ethers.BrowserProvider(window.ethereum);
      setProvider(provider);
      
      const signer = await provider.getSigner();
      const contractInstance = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      setContract(contractInstance);
      
    } catch (error) {
      console.error("Connection error:", error);
      
      // Handle specific error cases
      if (error.code === 4001) {
        alert("Connection rejected by user");
      } else if (error.code === -32002) {
        alert("Connection request already pending. Please check MetaMask.");
      } else {
        alert(`Failed to connect: ${error.message || error}`);
      }
    } finally {
      setLoading(false);
    }
  };

  // Logout/Disconnect Wallet Function
  const disconnectWallet = async () => {
    try {
      // Method 1: Try to disconnect from MetaMask (if supported)
      if (window.ethereum && window.ethereum.request) {
        try {
          // Some versions of MetaMask support this method
          await window.ethereum.request({
            method: "wallet_requestPermissions",
            params: [{ eth_accounts: {} }]
          });
        } catch (permissionError) {
          // If wallet_requestPermissions fails, try alternative methods
          console.log("Permission reset failed, using alternative disconnect method");
          
          try {
            // Method 2: Request account access with empty array (some wallets support this)
            await window.ethereum.request({
              method: "eth_requestAccounts",
              params: [{ force: false }]
            });
          } catch (accountError) {
            // Method 3: Clear the connection by requesting accounts again
            console.log("Using manual disconnect method");
          }
        }
      }
      
      // Clear all wallet-related state regardless of MetaMask response
      setAccount(null);
      setContract(null);
      setProvider(null);
      setMyNFTs([]);
      setListings([]);
      
      // Clear any modals or temporary state
      setShowListingModal(false);
      setSelectedNFT(null);
      setListingPrice("");
      
      // Clear form states
      setNftName("");
      setNftDescription("");
      setImageFile(null);
      setImagePreview(null);
      
      // Optional: Switch back to mint tab
      setActiveTab("mint");
      
      console.log("✅ Wallet disconnected successfully");
      
      // Show user notification about manual disconnect
      alert("🔓 App disconnected! To fully disconnect from MetaMask, please:\n\n1. Open MetaMask extension\n2. Click on 'Connected' tab\n3. Click 'Disconnect' next to this site\n\nOr refresh the page to reset connection.");
      
    } catch (error) {
      console.error("Disconnect error:", error);
      
      // Even if MetaMask disconnect fails, clear app state
      setAccount(null);
      setContract(null);
      setProvider(null);
      setMyNFTs([]);
      setListings([]);
      setShowListingModal(false);
      setSelectedNFT(null);
      setListingPrice("");
      setNftName("");
      setNftDescription("");
      setImageFile(null);
      setImagePreview(null);
      setActiveTab("mint");
      
      console.log("✅ App state cleared (MetaMask may still be connected)");
      alert("🔓 App disconnected! To fully disconnect from MetaMask, please manually disconnect from the MetaMask extension.");
    }
  };

  // Image Preview
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    setImageFile(file);
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result);
      reader.readAsDataURL(file);
    } else {
      setImagePreview(null);
    }
  };

  // Upload Image to IPFS
  const uploadToIPFS = async (file) => {
    if (!file) return null;
    try {
      setLoading(true);
      const formData = new FormData();
      formData.append('file', file);
      const response = await axios({
        method: 'POST',
        url: 'https://api.pinata.cloud/pinning/pinFileToIPFS',
        data: formData,
        headers: {
          'pinata_api_key': process.env.REACT_APP_PINATA_API_KEY,
          'pinata_secret_api_key': process.env.REACT_APP_PINATA_SECRET_KEY,
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data.IpfsHash;
    } catch {
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Upload Metadata to IPFS
  const pinJSONToIPFS = async (name, description, imageCID) => {
    try {
      const data = JSON.stringify({
        name,
        description,
        image: `ipfs://${imageCID}`,
      });
      const res = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
        method: 'POST',
        headers: {
          'Content-type': 'application/json',
          Authorization: `Bearer ${process.env.REACT_APP_PINATA_JWT}`,
        },
        body: data,
      });
      const resData = await res.json();
      return resData.IpfsHash;
    } catch {
      return null;
    }
  };

  // MINT NFT
  const handleMint = async (e) => {
    e.preventDefault();
    if (!contract) return alert('Contract not connected.');
    if (!nftName || !nftDescription || !imageFile) return alert('Fill all fields.');
    try {
      setLoading(true);
      const imageCID = await uploadToIPFS(imageFile);
      if (!imageCID) return alert('Image upload failed.');
      const metadataCID = await pinJSONToIPFS(nftName, nftDescription, imageCID);
      if (!metadataCID) return alert('Metadata upload failed.');
      const metadataURL = `https://gateway.pinata.cloud/ipfs/${metadataCID}`;
      const tx = await contract.mintNFT(metadataURL);
      await tx.wait();
      alert('NFT minted successfully!');
      setNftName("");
      setNftDescription("");
      setImageFile(null);
      setImagePreview(null);
      fetchMyNFTs();
    } catch (error) {
      alert('Minting failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // IMPROVED: Get My NFTs - Multiple methods for better compatibility
  const fetchMyNFTs = async () => {
    if (!contract || !account) {
      console.log("Contract or account not available");
      return;
    }
    
    setLoading(true);
    try {
      console.log("=== Fetching My NFTs ===");
      console.log("Account:", account);
      
      let tokenIds = [];
      
      // Method 1: Try tokensOfOwner if available
      try {
        tokenIds = await contract.tokensOfOwner(account);
        console.log("Method 1 - tokensOfOwner result:", tokenIds);
        tokenIds = tokenIds.map(id => id.toString());
      } catch (error) {
        console.log("Method 1 failed, trying alternative methods...", error.message);
        
        // Method 2: Try using balanceOf + tokenOfOwnerByIndex (if ERC721Enumerable)
        try {
          const balance = await contract.balanceOf(account);
          console.log("Account balance:", balance.toString());
          
          for (let i = 0; i < Number(balance); i++) {
            const tokenId = await contract.tokenOfOwnerByIndex(account, i);
            tokenIds.push(tokenId.toString());
          }
          console.log("Method 2 - ERC721Enumerable result:", tokenIds);
        } catch (enumerableError) {
          console.log("Method 2 failed, trying method 3...", enumerableError.message);
          
          // Method 3: Manual search through all tokens
          try {
            const totalSupply = await contract.getTotalSupply ? 
              await contract.getTotalSupply() : 
              await contract.totalSupply();
            console.log("Total supply:", totalSupply.toString());
            
            for (let tokenId = 0; tokenId < Number(totalSupply); tokenId++) {
              try {
                const owner = await contract.ownerOf(tokenId);
                if (owner.toLowerCase() === account.toLowerCase()) {
                  tokenIds.push(tokenId.toString());
                }
              } catch (ownerError) {
                // Token might not exist or be burned
                continue;
              }
            }
            console.log("Method 3 - Manual search result:", tokenIds);
          } catch (manualError) {
            console.error("All methods failed:", manualError);
            throw new Error("Could not fetch your NFTs. Please check contract implementation.");
          }
        }
      }

      console.log("Final token IDs:", tokenIds);
      
      // Fetch metadata and listing info for each token
      const nfts = await Promise.all(
        tokenIds.map(async (tokenId) => {
          try {
            console.log(`Processing token ${tokenId}...`);
            
            // Get token URI
            const tokenURI = await contract.tokenURI(tokenId);
            console.log(`Token ${tokenId} URI:`, tokenURI);
            
            // Check listing status
            let isListed = false, listingPrice = "0";
            try {
              // Method A: Try getListingInfo if available
              if (contract.getListingInfo) {
                const [listed, seller, price] = await contract.getListingInfo(tokenId);
                isListed = listed && seller.toLowerCase() === account.toLowerCase();
                if (isListed) listingPrice = ethers.formatEther(price);
              } else {
                // Method B: Direct listings mapping access
                const listing = await contract.listings(tokenId);
                isListed = listing.seller.toLowerCase() === account.toLowerCase() && Number(listing.price) > 0;
                if (isListed) listingPrice = ethers.formatEther(listing.price);
              }
              console.log(`Token ${tokenId} listing:`, { isListed, listingPrice });
            } catch (listingError) {
              console.log(`No listing found for token ${tokenId}:`, listingError.message);
            }
            
            // Fetch metadata
            let metadata = { name: 'Unknown', description: 'Metadata unavailable', image: null };
            try {
              const metadataURL = tokenURI.replace('ipfs://', 'https://gateway.pinata.cloud/ipfs/');
              const response = await fetch(metadataURL);
              
              if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
              }
              
              metadata = await response.json();
              console.log(`Token ${tokenId} metadata:`, metadata);
            } catch (metadataError) {
              console.log(`Failed to fetch metadata for token ${tokenId}:`, metadataError.message);
            }
            
            return { tokenId, metadata, isListed, listingPrice };
          } catch (tokenError) {
            console.error(`Error processing token ${tokenId}:`, tokenError);
            return {
              tokenId,
              metadata: { name: 'Error', description: 'Failed to load NFT data', image: null },
              isListed: false,
              listingPrice: "0"
            };
          }
        })
      );
      
      console.log("=== Final NFTs Array ===", nfts);
      setMyNFTs(nfts);
      
    } catch (error) {
      console.error("Critical error in fetchMyNFTs:", error);
      alert("Error fetching your NFTs: " + error.message);
      setMyNFTs([]); // Set empty array on error
    } finally {
      setLoading(false);
    }
  };

  // IMPROVED: Fetch Listings with better error handling
  const fetchListings = async () => {
    if (!contract) {
      console.log("Contract not available");
      return;
    }
    
    setLoading(true);
    try {
      console.log("=== Fetching Marketplace Listings ===");
      
      const [listingsData, tokenIds] = await contract.getAllListings();
      console.log("Raw listings data:", listingsData);
      console.log("Token IDs:", tokenIds.map(id => id.toString()));
      
      const validListings = [];
      
      for (let i = 0; i < listingsData.length; i++) {
        const listing = listingsData[i];
        const tokenId = tokenIds[i].toString();
        
        // Skip empty/invalid listings
        if (!listing.seller || listing.seller === "0x0000000000000000000000000000000000000000" || Number(listing.price) === 0) {
          console.log(`Skipping invalid listing for token ${tokenId}`);
          continue;
        }
        
        try {
          console.log(`Processing listing for token ${tokenId}...`);
          
          // Verify the NFT still exists and is owned by seller
          const currentOwner = await contract.ownerOf(tokenId);
          if (currentOwner.toLowerCase() !== listing.seller.toLowerCase()) {
            console.log(`Token ${tokenId} owner mismatch - skipping`);
            continue;
          }
          
          // Get metadata
          const tokenURI = await contract.tokenURI(tokenId);
          let metadata = { name: 'Unknown', description: 'Metadata unavailable', image: null };
          
          try {
            const metadataURL = tokenURI.replace('ipfs://', 'https://gateway.pinata.cloud/ipfs/');
            const response = await fetch(metadataURL);
            
            if (response.ok) {
              metadata = await response.json();
            }
          } catch (metadataError) {
            console.log(`Metadata fetch failed for token ${tokenId}:`, metadataError.message);
          }
          
          validListings.push({
            tokenId,
            seller: listing.seller,
            price: ethers.formatEther(listing.price),
            metadata
          });
          
        } catch (tokenError) {
          console.log(`Error processing token ${tokenId}:`, tokenError.message);
          continue;
        }
      }
      
      console.log("=== Valid Listings ===", validListings);
      setListings(validListings);
      
    } catch (error) {
      console.error("Error fetching listings:", error);
      alert("Error fetching listings: " + error.message);
      setListings([]);
    } finally {
      setLoading(false);
    }
  };

  // IMPROVED: Buy NFT with comprehensive error handling
  const buyNFT = async (tokenId, price) => {
    if (!contract || !account) {
      alert("❌ Please connect your wallet first!");
      connectWallet(); // Auto-prompt to connect
      return;
    }

    try {
      setLoading(true);
      console.log('=== Starting NFT Purchase ===');
      console.log('Token ID:', tokenId);
      console.log('Price:', price, 'ETH');
      console.log('Buyer:', account);
      
      // Convert price to wei
      const priceInWei = ethers.parseEther(price);
      console.log('Price in Wei:', priceInWei.toString());
      
      // Pre-purchase validations
      console.log('🔍 Running pre-purchase validations...');
      
      // Check if still listed
      const listing = await contract.listings(tokenId);
      if (!listing.seller || listing.seller === "0x0000000000000000000000000000000000000000" || Number(listing.price) === 0) {
        throw new Error('NFT is no longer listed for sale');
      }
      
      // Check current owner
      const currentOwner = await contract.ownerOf(tokenId);
      if (currentOwner.toLowerCase() !== listing.seller.toLowerCase()) {
        throw new Error('Seller no longer owns this NFT');
      }
      
      // Check if buyer is not the seller
      if (account.toLowerCase() === listing.seller.toLowerCase()) {
        throw new Error('You cannot buy your own NFT');
      }
      
      // Check buyer's balance
      const balance = await provider.getBalance(account);
      console.log('Buyer balance:', ethers.formatEther(balance), 'ETH');
      
      // Add gas estimation for total cost check
      let gasEstimate;
      try {
        gasEstimate = await contract.buyNFT.estimateGas(tokenId, { value: priceInWei });
        const gasPrice = (await provider.getFeeData()).gasPrice;
        const gasCost = gasEstimate * gasPrice;
        const totalCost = priceInWei + gasCost;
        
        if (balance < totalCost) {
          throw new Error(`Insufficient balance. Need ${ethers.formatEther(totalCost)} ETH (including gas)`);
        }
      } catch (gasError) {
        console.error('Gas estimation failed:', gasError);
        if (gasError.reason) {
          throw new Error('Transaction would fail: ' + gasError.reason);
        }
      }
      
      // Check marketplace approval
      const approved = await contract.getApproved(tokenId);
      const isApprovedForAll = await contract.isApprovedForAll(listing.seller, CONTRACT_ADDRESS);
      
      if (approved.toLowerCase() !== CONTRACT_ADDRESS.toLowerCase() && !isApprovedForAll) {
        throw new Error('Marketplace is not approved to transfer this NFT. Seller needs to approve first.');
      }
      
      console.log('✅ All validations passed. Executing purchase...');
      
      // Execute purchase with proper gas settings
      const tx = await contract.buyNFT(tokenId, {
        value: priceInWei,
        gasLimit: gasEstimate ? Math.floor(Number(gasEstimate) * 1.2) : 500000 // 20% buffer or fallback
      });
      
      console.log('Transaction sent:', tx.hash);
      console.log('⏳ Waiting for confirmation...');
      
      const receipt = await tx.wait();
      console.log('✅ Transaction confirmed!', receipt);
      
      alert(`🎉 Successfully purchased NFT #${tokenId} for ${price} ETH!`);
      
      // Refresh data
      await Promise.all([fetchListings(), fetchMyNFTs()]);
      
    } catch (error) {
      console.error('❌ Purchase Error:', error);
      
      let errorMessage = 'Purchase failed: ';
      
      if (error.message?.includes('insufficient funds')) {
        errorMessage += 'Insufficient funds in your wallet';
      } else if (error.message?.includes('user rejected')) {
        errorMessage += 'Transaction cancelled by user';
      } else if (error.message?.includes('NFT is no longer listed')) {
        errorMessage += 'This NFT is no longer available for purchase';
      } else if (error.message?.includes('Seller no longer owns')) {
        errorMessage += 'The seller no longer owns this NFT';
      } else if (error.message?.includes('cannot buy your own')) {
        errorMessage += 'You cannot purchase your own NFT';
      } else if (error.message?.includes('Marketplace is not approved')) {
        errorMessage += 'The marketplace is not approved to transfer this NFT';
      } else if (error.code === 'INSUFFICIENT_FUNDS') {
        errorMessage += 'Insufficient ETH balance to cover transaction cost';
      } else {
        errorMessage += error.reason || error.message || 'Unknown error occurred';
      }
      
      alert(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // List NFT Modal
  const openListingModal = (nft) => {
    setSelectedNFT(nft);
    setShowListingModal(true);
    setListingPrice("");
  };

  // IMPROVED: List NFT with better approval handling
  const handleListNFT = async () => {
    if (!contract || !selectedNFT || !listingPrice || parseFloat(listingPrice) <= 0) {
      alert('❌ Please enter a valid price greater than 0');
      return;
    }

    try {
      setLoading(true);
      const priceInWei = ethers.parseEther(listingPrice);
      
      console.log('=== Starting NFT Listing Process ===');
      console.log('Token ID:', selectedNFT.tokenId);
      console.log('Price:', listingPrice, 'ETH');
      console.log('Owner:', account);
      
      // Verify ownership
      const currentOwner = await contract.ownerOf(selectedNFT.tokenId);
      if (currentOwner.toLowerCase() !== account.toLowerCase()) {
        throw new Error('You no longer own this NFT');
      }
      
      // Check if already listed
      const existingListing = await contract.listings(selectedNFT.tokenId);
      if (existingListing.seller !== "0x0000000000000000000000000000000000000000" && Number(existingListing.price) > 0) {
        throw new Error('This NFT is already listed for sale');
      }
      
      // Check and handle approval
      const currentApproval = await contract.getApproved(selectedNFT.tokenId);
      const isApprovedForAll = await contract.isApprovedForAll(account, CONTRACT_ADDRESS);
      
      console.log('Current approval:', currentApproval);
      console.log('Is approved for all:', isApprovedForAll);
      
      if (currentApproval.toLowerCase() !== CONTRACT_ADDRESS.toLowerCase() && !isApprovedForAll) {
        console.log('⚠️ Approving marketplace contract...');
        alert('Please approve the marketplace contract in the next transaction to list your NFT.');
        
        const approveTx = await contract.approve(CONTRACT_ADDRESS, selectedNFT.tokenId);
        console.log('Approval TX:', approveTx.hash);
        console.log('⏳ Waiting for approval confirmation...');
        
        await approveTx.wait();
        console.log('✅ Marketplace approved');
        
        // Verify approval
        const newApproval = await contract.getApproved(selectedNFT.tokenId);
        if (newApproval.toLowerCase() !== CONTRACT_ADDRESS.toLowerCase()) {
          throw new Error('Approval failed - please try again');
        }
      }
      
      // Now list the NFT
      console.log('📝 Listing NFT for sale...');
      const listTx = await contract.listing(selectedNFT.tokenId, priceInWei);
      console.log('Listing TX:', listTx.hash);
      console.log('⏳ Waiting for listing confirmation...');
      
      await listTx.wait();
      console.log('✅ NFT listed successfully!');
      
      alert(`NFT #${selectedNFT.tokenId} listed for ${listingPrice} ETH!`);
      setShowListingModal(false);
      setSelectedNFT(null);
      setListingPrice("");
      
      // Refresh data
      await Promise.all([fetchListings(), fetchMyNFTs()]);
      
    } catch (error) {
      console.error(' Listing Error:', error);
      
      let errorMessage = 'Listing failed: ';
      
      if (error.message?.includes('Already listed')) {
        errorMessage += 'This NFT is already listed for sale';
      } else if (error.message?.includes('Not the owner')) {
        errorMessage += 'You do not own this NFT';
      } else if (error.message?.includes('user rejected')) {
        errorMessage += 'Transaction cancelled by user';
      } else if (error.message?.includes('You no longer own')) {
        errorMessage += 'You no longer own this NFT';
      } else if (error.message?.includes('already listed')) {
        errorMessage += 'This NFT is already listed for sale';
      } else if (error.message?.includes('Approval failed')) {
        errorMessage += 'Failed to approve marketplace - please try again';
      } else {
        errorMessage += error.reason || error.message || 'Unknown error occurred';
      }
      
      alert(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Cancel Listing
  const cancelListing = async (tokenId) => {
    if (!contract || !account) {
      alert("Please connect your wallet first!");
      return;
    }
    try {
      setLoading(true);
      console.log('Cancelling listing for token:', tokenId);
      
      const tx = await contract.cancelListing(tokenId);
      console.log('Cancel TX:', tx.hash);
      
      await tx.wait();
      console.log('✅ Listing cancelled!');
      
      alert("Listing cancelled successfully!");
      await Promise.all([fetchListings(), fetchMyNFTs()]);
    } catch (error) {
      console.error('Cancel error:', error);
      alert("Cancel failed: " + (error.reason || error.message));
    } finally {
      setLoading(false);
    }
  };

  // Auto-fetch data when contract is ready
  useEffect(() => {
    if (contract && account) {
      console.log("Contract and account ready, fetching data...");
      fetchListings();
      fetchMyNFTs();
    }
  }, [contract, account]);

  // Listen for account changes
  useEffect(() => {
    if (window.ethereum) {
      const handleAccountsChanged = async (accounts) => {
        if (accounts.length > 0) {
          setAccount(accounts[0]);
          if (contract && provider) {
            const signer = await provider.getSigner();
            const newContract = contract.connect(signer);
            setContract(newContract);
          }
        } else {
          setAccount(null);
          setContract(null);
          setProvider(null);
          setMyNFTs([]);
          setListings([]);
        }
      };

      window.ethereum.on('accountsChanged', handleAccountsChanged);
      
      return () => {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
      };
    }
  }, [contract, provider]);

  return (
    <div className="app gradient-bg">
      <header className="header">
        <div className="logo">
          <span className="logo-icon">🎨</span>
          <h1>MinterMint NFT Marketplace</h1>
        </div>
        <div className="wallet-section">
          {account ? (
            <div className="wallet-connected">
              <span className="wallet-chip">{account.slice(0, 6)}...{account.slice(-4)}</span>
              <button 
                onClick={disconnectWallet} 
                className="material-btn danger"
                style={{marginLeft: '0.75rem', padding: '0.5rem 1rem', fontSize: '0.8rem'}}
                title="Disconnect from App (Manual MetaMask disconnect required)"
              >
                🔓 Disconnect
              </button>
            </div>
          ) : (
            <button onClick={connectWallet} disabled={loading} className="material-btn primary">
              {loading ? "Connecting..." : <>🦊 Connect Wallet</>}
            </button>
          )}
        </div>
        <nav className="tabs">
          <button className={`tab ${activeTab === "mint" ? "active" : ""}`} onClick={() => setActiveTab('mint')}>Mint NFT</button>
          <button className={`tab ${activeTab === "marketplace" ? "active" : ""}`} onClick={() => setActiveTab('marketplace')}>Marketplace</button>
          <button className={`tab ${activeTab === "my-nfts" ? "active" : ""}`} onClick={() => setActiveTab('my-nfts')}>My NFTs</button>
        </nav>
      </header>

      <main>
        {/* Mint NFT */}
        {activeTab === 'mint' && (
          <section className="mint-section material-card">
            <h2>Mint Your NFT</h2>
            <form onSubmit={handleMint}>
              <input type="text" value={nftName} onChange={e => setNftName(e.target.value)} placeholder="NFT Name" required />
              <textarea value={nftDescription} onChange={e => setNftDescription(e.target.value)} placeholder="Description" required />
              <div className="file-upload-group">
                <input type="file" accept="image/*" onChange={handleImageChange} required />
                {imageFile && <span>✅ Image Selected</span>}
              </div>
              <button type="submit" disabled={loading || !account} className="material-btn secondary">
                {loading ? "Minting..." : "Mint NFT"}
              </button>
            </form>
            {imagePreview && (
              <div className="image-preview modern-card">
                <img src={imagePreview} alt="Preview" />
                <div>
                  <h4>{nftName}</h4>
                  <p>{nftDescription}</p>
                </div>
              </div>
            )}
          </section>
        )}

        {/* Marketplace - FIXED BUY BUTTON LOGIC */}
        {activeTab === 'marketplace' && (
          <section className="marketplace-section">
            <h2>Explore Marketplace</h2>
            <div className="marketplace-controls">
              <button onClick={fetchListings} disabled={loading} className="material-btn primary">
                {loading ? "Loading..." : "⟳ Refresh"}
              </button>
              <div className="debug-info">
                <small>Connected: {account ? "✅" : "❌"} | Contract: {contract ? "✅" : "❌"} | Listings: {listings.length}</small>
              </div>
            </div>
            <div className="nft-grid">
              {listings.length === 0 ? (
                <div className="empty-state">
                  <h4>No NFTs Listed</h4>
                  <p>Be the first to list an NFT for sale!</p>
                  <div className="empty-actions">
                    <button onClick={() => setActiveTab('my-nfts')} className="material-btn accent">
                      Check My NFTs
                    </button>
                    <button onClick={() => setActiveTab('mint')} className="material-btn secondary">
                      Mint New NFT
                    </button>
                  </div>
                </div>
              ) : (
                listings.map(nft => (
                  <div key={nft.tokenId} className="nft-card">
                    <img 
                      src={nft.metadata.image?.replace('ipfs://', 'https://gateway.pinata.cloud/ipfs/')} 
                      alt={nft.metadata.name}
                      onError={(e) => {
                        e.target.src = 'https://via.placeholder.com/300x300?text=Image+Not+Found';
                      }}
                    />
                    <div className="nft-info">
                      <h3>{nft.metadata.name || 'Unknown'}</h3>
                      <p>{nft.metadata.description || 'No description'}</p>
                      <div className="price-section">
                        <span className="price">💎 {nft.price} ETH</span>
                      </div>
                      <div className="seller-info">
                        <small>Seller: {nft.seller.slice(0, 6)}...{nft.seller.slice(-4)}</small>
                      </div>
                      <div className="nft-actions">
                        {/* FIXED: Show buy button for everyone except the seller */}
                        {account && account.toLowerCase() === nft.seller.toLowerCase() ? (
                          // User owns this NFT - show cancel option
                          <button 
                            className="material-btn danger" 
                            onClick={() => cancelListing(nft.tokenId)}
                            disabled={loading}
                          >
                            {loading ? "Cancelling..." : "Cancel Listing"}
                          </button>
                        ) : (
                          // User doesn't own this NFT OR user not connected - show buy option
                          <button 
                            className="material-btn accent" 
                            onClick={() => buyNFT(nft.tokenId, nft.price)}
                            disabled={loading}
                          >
                            {loading ? "Processing..." : `Buy for ${nft.price} ETH`}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        )}

        {/* My NFTs */}
        {activeTab === 'my-nfts' && (
          <section className="my-nfts-section">
            <h2>My NFT Collection</h2>
            <div className="my-nfts-controls">
              <button onClick={fetchMyNFTs} disabled={loading} className="material-btn primary">
                {loading ? "Loading..." : "⟳ Refresh"}
              </button>
              <div className="debug-info">
                <small>Account: {account ? "✅" : "❌"} | Contract: {contract ? "✅" : "❌"} | My NFTs: {myNFTs.length}</small>
              </div>
            </div>
            <div className="nft-grid">
              {!account ? (
                <div className="empty-state">
                  <h4>Connect Your Wallet</h4>
                  <p>Please connect your wallet to see your NFTs</p>
                  <button onClick={connectWallet} className="material-btn primary">🦊 Connect Wallet</button>
                </div>
              ) : myNFTs.length === 0 && !loading ? (
                <div className="empty-state">
                  <h4>No NFTs Found</h4>
                  <p>You don't own any NFTs yet. Start building your collection!</p>
                  <div className="empty-actions">
                    <button onClick={() => setActiveTab('mint')} className="material-btn accent">Mint Your First NFT</button>
                    <button onClick={() => setActiveTab('marketplace')} className="material-btn secondary">Browse Marketplace</button>
                  </div>
                </div>
              ) : loading ? (
                <div className="loading-state">
                  <h4>Loading your NFTs...</h4>
                  <p>Please wait while we fetch your collection.</p>
                </div>
              ) : (
                myNFTs.map((nft, idx) => (
                  <div key={`${nft.tokenId}-${idx}`} className="nft-card modern-card">
                    <div className="nft-image-container">
                      <img 
                        src={nft.metadata.image?.replace('ipfs://', 'https://gateway.pinata.cloud/ipfs/')} 
                        alt={nft.metadata.name || 'NFT'}
                        onError={(e) => {
                          e.target.src = 'https://via.placeholder.com/300x300?text=Image+Not+Found';
                        }}
                      />
                    </div>
                    <div className="nft-info">
                      <h4>{nft.metadata.name || 'Unnamed NFT'}</h4>
                      <p>{nft.metadata.description || 'No description available'}</p>
                      <div className="token-id">Token ID: #{nft.tokenId}</div>
                      
                      <div className="nft-status">
                        {nft.isListed ? (
                          <div className="listed-status">
                            <span className="badge success">📈 Listed for {nft.listingPrice} ETH</span>
                            <button 
                              onClick={() => cancelListing(nft.tokenId)} 
                              disabled={loading} 
                              className="material-btn danger"
                              style={{marginTop: '10px', width: '100%'}}
                            >
                              {loading ? "Cancelling..." : "❌ Cancel Listing"}
                            </button>
                          </div>
                        ) : (
                          <div className="not-listed-status">
                            <span className="badge neutral">💎 Not Listed</span>
                            <button 
                              onClick={() => openListingModal(nft)} 
                              disabled={loading} 
                              className="material-btn accent"
                              style={{marginTop: '10px', width: '100%'}}
                            >
                              {loading ? "Loading..." : "🏷️ List for Sale"}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        )}
      </main>

      {/* Listing Modal */}
      {showListingModal && (
        <div className="modal-overlay" onClick={() => setShowListingModal(false)}>
          <div className="modal material-card" onClick={e => e.stopPropagation()}>
            <h3>List NFT for Sale</h3>
            <div className="modal-nft-preview">
              <img 
                src={selectedNFT?.metadata.image?.replace('ipfs://', 'https://gateway.pinata.cloud/ipfs/')} 
                alt={selectedNFT?.metadata.name}
                onError={(e) => {
                  e.target.src = 'https://via.placeholder.com/200x200?text=Image+Not+Found';
                }}
              />
              <div className="modal-nft-info">
                <h4>{selectedNFT?.metadata.name}</h4>
                <p>{selectedNFT?.metadata.description}</p>
                <span className="token-id">Token ID: #{selectedNFT?.tokenId}</span>
              </div>
            </div>
            <div className="price-input-section">
              <label>Price in ETH:</label>
              <input 
                type="number" 
                step="0.001" 
                min="0.001"
                value={listingPrice}
                onChange={e => setListingPrice(e.target.value)}
                placeholder="Enter price in ETH (e.g., 0.1)"
                required
              />
              <small>Minimum price: 0.001 ETH</small>
            </div>
            <div className="modal-actions">
              <button 
                onClick={() => setShowListingModal(false)} 
                className="material-btn"
                disabled={loading}
              >
                Cancel
              </button>
              <button 
                onClick={handleListNFT} 
                disabled={loading || !listingPrice || parseFloat(listingPrice) <= 0} 
                className="material-btn accent"
              >
                {loading ? "Listing..." : `List for ${listingPrice || '0'} ETH`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading Overlay */}
      {loading && (
        <div className="loading-overlay">
          <div className="loading-spinner">
            <div className="spinner"></div>
            <p>Processing transaction...</p>
            <small>Please confirm in MetaMask and wait for confirmation</small>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;