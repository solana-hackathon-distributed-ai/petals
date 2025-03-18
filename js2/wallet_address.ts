import { PublicKey, Connection, clusterApiUrl } from '@solana/web3.js';

// Example: Using your public key
const publicKeyString = "FDXpbvGtYd4DRRC7VTy3U3X57CeSpGVmckP6bM3jM8eu"; // Replace with your public key
const publicKey = new PublicKey(publicKeyString);

// Connect to the Devnet
const connection = new Connection(clusterApiUrl('devnet'));

// Retrieve the wallet address (this is simply the public key for Solana)
console.log("Wallet Address (Public Key):", publicKey.toString());
