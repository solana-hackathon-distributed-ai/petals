import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import fs from 'fs';

// Replace with your private key from Phantom (base58 encoded string)
const privateKeyString = '5iY3Y6xtNsX1nQgSRc358XgVNofLChiyeZQYSC275fqVPeWmogwPcLFvMh5BgVF7PxjXUKoWRowHaZUCKFL6yG6Y';

// Decode the base58 private key
const privateKey = bs58.decode(privateKeyString);

// Create keypair from private key
const keypair = Keypair.fromSecretKey(privateKey);

// Verify the public key matches what you expect
console.log("Public key:", keypair.publicKey.toString());

// Save to file (be careful with this file - it contains your private key!)
fs.writeFileSync('wallet-keypair.json', JSON.stringify(Array.from(keypair.secretKey)));