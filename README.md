🖼️ ERC-721 NFT Marketplace
A decentralized NFT Marketplace where users can mint, list, buy, and cancel NFTs.
Built with Solidity, Foundry, and React — powered by OpenZeppelin smart contract standards.

🚀 Features
🏗 Mint NFTs with custom metadata (name, description, image, etc.)

📜 List NFTs for sale with a fixed price

💸 Buy NFTs securely with automatic fund transfer to the seller

❌ Cancel listings anytime before a sale

🔒 Secure smart contract design using ReentrancyGuard and Ownable

📂 Metadata storage with ERC721URIStorage

📊 Fully tested with Foundry

🛠️ Tech Stack
Smart Contracts

Solidity

OpenZeppelin ERC-721, URIStorage, Enumerable

Foundry (Forge, Cast, Anvil)

Frontend

React.js

Ethers.js

Vercel Hosting

📦 Installation
bash
Copy
Edit
# 1️⃣ Clone the repository
git clone git clone https://github.com/Atharva-Joshi8999/NFT-Marketplace_721.git

# 2️⃣ Install dependencies
cd nft-marketplace
npm install

# 3️⃣ Run frontend
npm start
🔑 Smart Contract Deployment
bash
Copy
Edit
# Compile contracts
forge build

# Run tests
forge test

# Deploy to local or testnet
forge script script/Deploy.s.sol --rpc-url <RPC_URL> --private-key <PRIVATE_KEY> --broadcast
🌍 Live Demo
🚀 Hosted on Vercel: View Live Marketplace

📄 License
This project is licensed under the MIT License — you’re free to use, modify, and distribute it.

🔥 Built with ❤️ by Atharva Joshi
