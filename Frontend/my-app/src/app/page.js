'use client';

import { useState } from "react";
import { ethers } from "ethers";

import { CONTRACT_ADDRESS, CONTRACT_ABI } from "./contract";

export default function Home() {
  const [account, setAccount] = useState(null);
  const [contract, setContract] = useState(null);
  const [nftName, setNftName] = useState("");
  const [nftMetadata, setNftMetadata] = useState("");
  const [imageFile, setImageFile] = useState(null);

  const connectWallet = async () => {
    if (window?.ethereum) {
      try {
        const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
        setAccount(accounts[0]);

        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const contractInstance = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

        setContract(contractInstance);
        console.log(" Connected to contract:", contractInstance);

        const functionNames = contractInstance.interface.fragments
          .filter(fragment => fragment.type === "function")
          .map(fragment => fragment.name);

        console.log("🔹 Contract functions:", functionNames);
      } catch (err) {
        console.error("❌ User rejected connection", err);
      }
    } else {
      alert("⚠️ Please install MetaMask!");
    }
  };

  const uploadToIPFS = async file => {
    if (file) {
      try {
        const formData = new FormData();
        formData.append('file', file);
        const response = await axios({
          method: 'POST',
          url: 'https://api.pinata.cloud/pinning/pinFileToIPFS',
          data: formData,
          headers: {
            'pinata_api_key': process.env.YOUR_PINATA_API_KEY,
            'pinata_secret_api_key': process.env.YOUR_PINATA_SECRET_KEY,
            'Content-Type': 'multipart/form-data',
          },
        });
        console.log("Image uploaded to Pinata:", response.data.IpfsHash);
        const CID = response.data.IpfsHash;
        const ImgHash = `https://gateway.pinata.cloud/ipfs/${CID}`;
        console.log(ImgHash);
        return CID;
      } catch (error) {
        console.log('Unable to upload image to Pinata');
      }
    }
  };

  const pinJSONToIPFS = async (name, description, CID) => {
    try {
      const data = JSON.stringify({
        name: name,
        description: description,
        image: `ipfs://${CID}`,
      });
      const res = await fetch(
        'https://api.pinata.cloud/pinning/pinJSONToIPFS',
        {
          method: 'POST',
          headers: {
            'Content-type': 'application/json',
            Authorization: `Bearer ${process.env.YOUR_PINATA_JWT}`,
          },
          body: data,
        }
      );
      const resData = await res.json();
      console.log('Metadata uploaded', CID, resData.IpfsHash);
      return resData.IpfsHash;
    } catch (error) {
      console.error('Error uploading metadata', error);
    }
  };

  const handleMint = async (e) => {
    e.preventDefault();
    if (!contract) return alert('Contract not connected.');
    if (!nftName || !nftMetadata || !imageFile) return alert('Fill all fields.');

    const imageUrl = await uploadToIPFS(imageFile);
    console.log('Image URL:', imageUrl);
    if (!imageUrl) return alert('Image upload failed.');

    const metadataCID = await pinJSONToIPFS(nftName, nftMetadata, imageUrl);
    console.log('Metadata CID:', metadataCID);
    const metadataUrl = `https://gateway.pinata.cloud/ipfs/${metadataCID}`;
    console.log('Metadata URL:', metadataUrl);
  };

  return (
    <main style={{ padding: "2rem" }}>
      <h1>Hello in frontend</h1>
      {account ? <p>Connected: {account}</p> : <button onClick={connectWallet}>Connect MetaMask</button>}

      <form onSubmit={handleMint} className="nft-form">
        <div>
          <label>NFT Name:</label>
          <input type="text" value={nftName} onChange={(e) => setNftName(e.target.value)} />
        </div>
        <div>
          <label>Description:</label>
          <textarea value={nftMetadata} onChange={(e) => setNftMetadata(e.target.value)} />
        </div>
        <div>
          <label>Image File:</label>
          <input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files[0])} />
        </div>
        <button type="submit">Mint NFT</button>
      </form>
    </main>
  );
}
