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

  // Mint NFT States
  const [nftName, setNftName] = useState("");
  const [nftDescription, setNftDescription] = useState("");
  const [imageFile, setImageFile] = useState(null);

  // Marketplace States
  const [listings, setListings] = useState([]);
  const [myNFTs, setMyNFTs] = useState([]);
  const [activeTab, setActiveTab] = useState("mint");

  // Connect Wallet
  const connectWallet = async () => {
    if (window.ethereum) {
      try {
        setLoading(true);
        const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
        setAccount(accounts[0]);

        const provider = new ethers.BrowserProvider(window.ethereum);
        setProvider(provider);
        const signer = await provider.getSigner();
        const contractInstance = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

        setContract(contractInstance);
        console.log("Connected to contract:", contractInstance);

        // Check if we're on Sepolia testnet
        const network = await provider.getNetwork();
        console.log("Network:", network);
        
        setLoading(false);
      } catch (err) {
        console.error("User rejected connection", err);
        setLoading(false);
      }
    } else {
      alert("Please install MetaMask!");
    }
  };

  // Upload image to IPFS
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

      console.log("Image uploaded to Pinata:", response.data.IpfsHash);
      return response.data.IpfsHash;
    } catch (error) {
      console.error('Unable to upload image to Pinata', error);
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Upload metadata to IPFS
  const pinJSONToIPFS = async (name, description, imageCID) => {
    try {
      const data = JSON.stringify({
        name: name,
        description: description,
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
      console.log('Metadata uploaded:', resData.IpfsHash);
      return resData.IpfsHash;
    } catch (error) {
      console.error('Error uploading metadata', error);
      return null;
    }
  };

  // Mint NFT (Note: Your contract doesn't have a mint function, you'll need to add one)
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
      console.log('Metadata URL:', metadataURL);

      // Note: Your contract doesn't have a mint function. You'll need to add one to your contract
      // For now, this will show an error
      alert('Note: Your contract needs a mint function. Please add one to your smart contract.');
      
      // Reset form
      setNftName("");
      setNftDescription("");
      setImageFile(null);
      
    } catch (error) {
      console.error('Minting failed:', error);
      alert('Minting failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Get all listings
  const fetchListings = async () => {
    if (!contract) return;

    try {
      setLoading(true);
      const [listingsData, tokenIds] = await contract.getAllListings();
      
      const listingsWithMetadata = await Promise.all(
        listingsData.map(async (listing, index) => {
          try {
            const tokenURI = await contract.tokenURI(tokenIds[index]);
            const response = await fetch(tokenURI.replace('ipfs://', 'https://gateway.pinata.cloud/ipfs/'));
            const metadata = await response.json();
            
            return {
              tokenId: tokenIds[index].toString(),
              seller: listing.seller,
              price: ethers.formatEther(listing.price),
              metadata
            };
          } catch (error) {
            console.error('Error fetching metadata for token:', tokenIds[index]);
            return {
              tokenId: tokenIds[index].toString(),
              seller: listing.seller,
              price: ethers.formatEther(listing.price),
              metadata: { name: 'Unknown', description: 'Metadata unavailable' }
            };
          }
        })
      );

      setListings(listingsWithMetadata);
    } catch (error) {
      console.error('Error fetching listings:', error);
    } finally {
      setLoading(false);
    }
  };

  // Buy NFT
  const buyNFT = async (tokenId, price) => {
    if (!contract) return alert('Contract not connected.');

    try {
      setLoading(true);
      const tx = await contract.buyNFT(tokenId, {
        value: ethers.parseEther(price)
      });
      
      await tx.wait();
      alert('NFT purchased successfully!');
      fetchListings(); // Refresh listings
    } catch (error) {
      console.error('Purchase failed:', error);
      alert('Purchase failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // List NFT for sale
  const listNFT = async (tokenId, price) => {
    if (!contract) return alert('Contract not connected.');

    try {
      setLoading(true);
      const priceInWei = ethers.parseEther(price);
      const tx = await contract.listing(tokenId, priceInWei);
      
      await tx.wait();
      alert('NFT listed successfully!');
      fetchListings(); // Refresh listings
    } catch (error) {
      console.error('Listing failed:', error);
      alert('Listing failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Cancel listing
  const cancelListing = async (tokenId) => {
    if (!contract) return alert('Contract not connected.');

    try {
      setLoading(true);
      const tx = await contract.cancelListing(tokenId);
      
      await tx.wait();
      alert('Listing cancelled successfully!');
      fetchListings(); // Refresh listings
    } catch (error) {
      console.error('Cancel failed:', error);
      alert('Cancel failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Fetch listings when contract is connected
  useEffect(() => {
    if (contract) {
      fetchListings();
    }
  }, [contract]);

  return (
    <div className="App">
      <header className="App-header">
        <h1>🏪 NFT Marketplace</h1>
        
        {account ? (
          <div className="wallet-info">
            <p>Connected: {account.substring(0, 6)}...{account.substring(38)}</p>
          </div>
        ) : (
          <button onClick={connectWallet} disabled={loading}>
            {loading ? 'Connecting...' : 'Connect MetaMask'}
          </button>
        )}

        <nav className="tabs">
          <button 
            className={activeTab === 'mint' ? 'active' : ''} 
            onClick={() => setActiveTab('mint')}
          >
            Mint NFT
          </button>
          <button 
            className={activeTab === 'marketplace' ? 'active' : ''} 
            onClick={() => setActiveTab('marketplace')}
          >
            Marketplace
          </button>
        </nav>
      </header>

      <main className="App-main">
        {activeTab === 'mint' && (
          <section className="mint-section">
            <h2>🎨 Mint New NFT</h2>
            <form onSubmit={handleMint} className="mint-form">
              <div className="form-group">
                <label>NFT Name:</label>
                <input
                  type="text"
                  value={nftName}
                  onChange={(e) => setNftName(e.target.value)}
                  required
                />
              </div>
              
              <div className="form-group">
                <label>Description:</label>
                <textarea
                  value={nftDescription}
                  onChange={(e) => setNftDescription(e.target.value)}
                  required
                />
              </div>
              
              <div className="form-group">
                <label>Image File:</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setImageFile(e.target.files[0])}
                  required
                />
              </div>
              
              <button type="submit" disabled={loading || !account}>
                {loading ? 'Minting...' : 'Mint NFT'}
              </button>
            </form>
          </section>
        )}

        {activeTab === 'marketplace' && (
          <section className="marketplace-section">
            <div className="section-header">
              <h2>🛒 Marketplace</h2>
              <button onClick={fetchListings} disabled={loading}>
                {loading ? 'Loading...' : 'Refresh'}
              </button>
            </div>

            <div className="listings-grid">
              {listings.length === 0 ? (
                <p>No NFTs listed for sale</p>
              ) : (
                listings.map((listing, index) => (
                  <div key={index} className="listing-card">
                    {listing.metadata.image && (
                      <img 
                        src={listing.metadata.image.replace('ipfs://', 'https://gateway.pinata.cloud/ipfs/')} 
                        alt={listing.metadata.name}
                      />
                    )}
                    
                    <div className="listing-info">
                      <h3>{listing.metadata.name || 'Unknown NFT'}</h3>
                      <p>{listing.metadata.description}</p>
                      <p><strong>Price: {listing.price} ETH</strong></p>
                      <p>Seller: {listing.seller.substring(0, 6)}...{listing.seller.substring(38)}</p>
                      
                      {listing.seller.toLowerCase() === account?.toLowerCase() ? (
                        <button 
                          onClick={() => cancelListing(listing.tokenId)}
                          disabled={loading}
                        >
                          Cancel Listing
                        </button>
                      ) : (
                        <button 
                          onClick={() => buyNFT(listing.tokenId, listing.price)}
                          disabled={loading || !account}
                        >
                          Buy NFT
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

export default App;