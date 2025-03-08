// Import the express in typescript file
import { Connection, clusterApiUrl, Keypair, LAMPORTS_PER_SOL, PublicKey, Transaction, SystemProgram } from '@solana/web3.js';
import fs from 'fs';
import express from 'express';

// Initialize the express engine
const app: express.Application = express();

// Take a port 3000 for running server.
const port: number = 3000;

// Read the keypair from the keypair.json file
const keypairPath = 'keypair.json';
const keypairData = fs.readFileSync(keypairPath, 'utf8');
const keypair = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(keypairData)));

// Extract the public key
const publicKey = keypair.publicKey.toBase58();

// Print the public key to the console
console.log(`Public Key: ${publicKey}`);

// Handling '/' Request
app.use(express.json()); // Add this line to parse JSON request bodies

app.post('/sol', async (req, res) => {
    const { num_blocks, amount_per_block, recipient } = req.body;
    console.log(`Received request to send ${amount_per_block} tokens for ${num_blocks} blocks to ${recipient}`);

    try {
        // Convert recipient to PublicKey object
        const recipientPublicKey = new PublicKey(recipient);
        console.log(`Recipient Public Key: ${recipientPublicKey.toBase58()}`);

        const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');
        const totalAmount = num_blocks * amount_per_block;

        for (let i = 0; i < num_blocks; i++) {
            const transaction = new Transaction().add(
                SystemProgram.transfer({
                    fromPubkey: keypair.publicKey, // Ensure this is a PublicKey object
                    toPubkey: recipientPublicKey, // Ensure this is a PublicKey object
                    lamports: amount_per_block * LAMPORTS_PER_SOL, // Convert to lamports
                })
            );

            const signature = await connection.sendTransaction(transaction, [keypair]);
            await connection.confirmTransaction(signature);
            console.log(`Transaction ${i + 1}/${num_blocks} confirmed with signature: ${signature}`);
        }

        res.status(200).send({ success: true, totalAmount });
        console.log(`Successfully sent ${totalAmount} tokens`);
    } catch (error) {
        res.status(500).send({ success: false, error: error.message });
        console.error(`Failed to send tokens: ${error.message}`);
    }
});

// Server setup
app.listen(port, () => {
    console.log(`TypeScript with Express 
         http://localhost:${port}/`);
});

