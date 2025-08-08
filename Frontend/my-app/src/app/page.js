'use client';

import { useState } from "react";
import { ethers } from "ethers";
import { CONTRACT_ADDRESS, CONTRACT_ABI } from "./contract";

export default function Home() {
  const [account, setAccount] = useState(null);
  const [contract, setContract] = useState(null);

  const connectWallet = async () => {
  if (window?.ethereum) {
    try {
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      setAccount(accounts[0]);

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contractInstance = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

      setContract(contractInstance);
      console.log("✅ Connected to contract:", contractInstance);

      // Print all function names in console
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


  return (
    <main style={{ padding: "2rem" }}>
      <h1>Hello in frontend</h1>
      {account ? <p>Connected: {account}</p> : <button onClick={connectWallet}>Connect MetaMask</button>}
    </main>
  );
}
