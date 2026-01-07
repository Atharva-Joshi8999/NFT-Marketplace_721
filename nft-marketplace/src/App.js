import { useState, useEffect } from "react";
import { ethers } from "ethers";
import axios from "axios";
import { CONTRACT_ADDRESS, CONTRACT_ABI } from "./contract";
import "./App.css";

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

  // Check existing wallet connection on load
  useEffect(() => {
    const checkConnection = async () => {
      if (!window.ethereum) return;

      const accounts = await window.ethereum.request({ method: "eth_accounts" });
      if (accounts.length > 0) {
        setAccount(accounts[0]);
        const provider = new ethers.BrowserProvider(window.ethereum);
        setProvider(provider);
        const signer = await provider.getSigner();
        const contractInstance = new ethers.Contract(
          CONTRACT_ADDRESS,
          CONTRACT_ABI,
          signer
        );
        setContract(contractInstance);
      }
    };

    checkConnection();
  }, []);

  // Connect wallet
  const connectWallet = async () => {
    if (!window.ethereum) return alert("MetaMask not installed");

    try {
      setLoading(true);
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });

      setAccount(accounts[0]);
      const provider = new ethers.BrowserProvider(window.ethereum);
      setProvider(provider);
      const signer = await provider.getSigner();
      const contractInstance = new ethers.Contract(
        CONTRACT_ADDRESS,
        CONTRACT_ABI,
        signer
      );
      setContract(contractInstance);
    } catch (error) {
      alert(error.message || "Connection failed");
    } finally {
      setLoading(false);
    }
  };

  // Disconnect app state
  const disconnectWallet = () => {
    setAccount(null);
    setContract(null);
    setProvider(null);
    setMyNFTs([]);
    setListings([]);
    setActiveTab("mint");
  };

  // Image select + preview
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

  // Upload image to IPFS
  const uploadToIPFS = async (file) => {
    if (!file) return null;

    const formData = new FormData();
    formData.append("file", file);

    const response = await axios.post(
      "https://api.pinata.cloud/pinning/pinFileToIPFS",
      formData,
      {
        headers: {
          pinata_api_key: process.env.REACT_APP_PINATA_API_KEY,
          pinata_secret_api_key: process.env.REACT_APP_PINATA_SECRET_KEY,
          "Content-Type": "multipart/form-data",
        },
      }
    );

    return response.data.IpfsHash;
  };

  // Upload metadata to IPFS
  const pinJSONToIPFS = async (name, description, imageCID) => {
    const data = JSON.stringify({
      name,
      description,
      image: `ipfs://${imageCID}`,
    });

    const res = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.REACT_APP_PINATA_JWT}`,
      },
      body: data,
    });

    const resData = await res.json();
    return resData.IpfsHash;
  };

  // Mint NFT
  const handleMint = async (e) => {
    e.preventDefault();

    if (!contract || !nftName || !nftDescription || !imageFile)
      return alert("Fill all fields");

    try {
      setLoading(true);

      const imageCID = await uploadToIPFS(imageFile);
      const metadataCID = await pinJSONToIPFS(
        nftName,
        nftDescription,
        imageCID
      );

      const metadataURL = `https://gateway.pinata.cloud/ipfs/${metadataCID}`;

      const tx = await contract.mintNFT(metadataURL);
      await tx.wait();

      setNftName("");
      setNftDescription("");
      setImageFile(null);
      setImagePreview(null);

      fetchMyNFTs();
    } catch (error) {
      alert(error.message || "Minting failed");
    } finally {
      setLoading(false);
    }
  };

  // Fetch user NFTs
  const fetchMyNFTs = async () => {
    if (!contract || !account) return;

    try {
      setLoading(true);
      const tokenIds = await contract.tokensOfOwner(account);

      const nfts = await Promise.all(
        tokenIds.map(async (id) => {
          const tokenId = id.toString();
          const tokenURI = await contract.tokenURI(tokenId);
          const metadataURL = tokenURI.replace(
            "ipfs://",
            "https://gateway.pinata.cloud/ipfs/"
          );

          const metadata = await fetch(metadataURL).then((res) => res.json());

          let isListed = false;
          let listingPrice = "0";

          try {
            const listing = await contract.listings(tokenId);
            if (Number(listing.price) > 0) {
              isListed = true;
              listingPrice = ethers.formatEther(listing.price);
            }
          } catch {}

          return { tokenId, metadata, isListed, listingPrice };
        })
      );

      setMyNFTs(nfts);
    } catch (error) {
      setMyNFTs([]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch marketplace listings
  const fetchListings = async () => {
    if (!contract) return;

    try {
      setLoading(true);
      const [listingsData, tokenIds] = await contract.getAllListings();

      const validListings = [];

      for (let i = 0; i < listingsData.length; i++) {
        const listing = listingsData[i];
        const tokenId = tokenIds[i].toString();

        if (Number(listing.price) === 0) continue;

        const tokenURI = await contract.tokenURI(tokenId);
        const metadataURL = tokenURI.replace(
          "ipfs://",
          "https://gateway.pinata.cloud/ipfs/"
        );
        const metadata = await fetch(metadataURL).then((res) => res.json());

        validListings.push({
          tokenId,
          seller: listing.seller,
          price: ethers.formatEther(listing.price),
          metadata,
        });
      }

      setListings(validListings);
    } catch (error) {
      setListings([]);
    } finally {
      setLoading(false);
    }
  };

  // Buy NFT
  const buyNFT = async (tokenId, price) => {
    if (!contract || !account) return alert("Connect wallet");

    try {
      setLoading(true);
      const tx = await contract.buyNFT(tokenId, {
        value: ethers.parseEther(price),
      });
      await tx.wait();

      fetchListings();
      fetchMyNFTs();
    } catch (error) {
      alert(error.message || "Purchase failed");
    } finally {
      setLoading(false);
    }
  };

  // List NFT
  const handleListNFT = async () => {
    if (!contract || !selectedNFT || !listingPrice) return;

    try {
      setLoading(true);

      const approval = await contract.getApproved(selectedNFT.tokenId);
      if (approval.toLowerCase() !== CONTRACT_ADDRESS.toLowerCase()) {
        const approveTx = await contract.approve(
          CONTRACT_ADDRESS,
          selectedNFT.tokenId
        );
        await approveTx.wait();
      }

      const tx = await contract.listing(
        selectedNFT.tokenId,
        ethers.parseEther(listingPrice)
      );
      await tx.wait();

      setShowListingModal(false);
      setSelectedNFT(null);
      setListingPrice("");

      fetchListings();
      fetchMyNFTs();
    } catch (error) {
      alert(error.message || "Listing failed");
    } finally {
      setLoading(false);
    }
  };

  // Cancel listing
  const cancelListing = async (tokenId) => {
    if (!contract) return;

    try {
      setLoading(true);
      const tx = await contract.cancelListing(tokenId);
      await tx.wait();

      fetchListings();
      fetchMyNFTs();
    } catch (error) {
      alert(error.message || "Cancel failed");
    } finally {
      setLoading(false);
    }
  };

  // Auto fetch
  useEffect(() => {
    if (contract && account) {
      fetchListings();
      fetchMyNFTs();
    }
  }, [contract, account]);

  return (
    <div className="app">
      <header className="header">
        <h1>MinterMint NFT Marketplace</h1>

        <div>
          {account ? (
            <button onClick={disconnectWallet}>Disconnect</button>
          ) : (
            <button onClick={connectWallet} disabled={loading}>
              Connect Wallet
            </button>
          )}
        </div>

        <div className="tabs">
          <button onClick={() => setActiveTab("mint")}>Mint</button>
          <button onClick={() => setActiveTab("marketplace")}>Marketplace</button>
          <button onClick={() => setActiveTab("my-nfts")}>My NFTs</button>
        </div>
      </header>

      <main>
        {activeTab === "mint" && (
          <form onSubmit={handleMint}>
            <input
              type="text"
              placeholder="NFT Name"
              value={nftName}
              onChange={(e) => setNftName(e.target.value)}
            />
            <textarea
              placeholder="Description"
              value={nftDescription}
              onChange={(e) => setNftDescription(e.target.value)}
            />
            <input type="file" onChange={handleImageChange} />
            <button type="submit" disabled={loading || !account}>
              Mint
            </button>
          </form>
        )}

        {activeTab === "marketplace" && (
          <div>
            <button onClick={fetchListings}>Refresh</button>
            {listings.map((nft) => (
              <div key={nft.tokenId}>
                <img
                  src={nft.metadata.image.replace(
                    "ipfs://",
                    "https://gateway.pinata.cloud/ipfs/"
                  )}
                  alt=""
                />
                <h3>{nft.metadata.name}</h3>
                <p>{nft.price} ETH</p>
                <button onClick={() => buyNFT(nft.tokenId, nft.price)}>
                  Buy
                </button>
              </div>
            ))}
          </div>
        )}

        {activeTab === "my-nfts" && (
          <div>
            {myNFTs.map((nft) => (
              <div key={nft.tokenId}>
                <img
                  src={nft.metadata.image.replace(
                    "ipfs://",
                    "https://gateway.pinata.cloud/ipfs/"
                  )}
                  alt=""
                />
                <h3>{nft.metadata.name}</h3>

                {nft.isListed ? (
                  <button onClick={() => cancelListing(nft.tokenId)}>
                    Cancel Listing
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setSelectedNFT(nft);
                      setShowListingModal(true);
                    }}
                  >
                    List for Sale
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      {showListingModal && (
        <div className="modal">
          <input
            type="number"
            placeholder="Price in ETH"
            value={listingPrice}
            onChange={(e) => setListingPrice(e.target.value)}
          />
          <button onClick={handleListNFT}>List</button>
          <button onClick={() => setShowListingModal(false)}>Close</button>
        </div>
      )}
    </div>
  );
}

export default App;
