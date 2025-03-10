import { Connection, clusterApiUrl, Keypair, PublicKey, Transaction, SendTransactionError } from '@solana/web3.js';
import { createTransferInstruction, getAccount, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction } from '@solana/spl-token';
import fs from 'fs';
import express from 'express';

// Initialize the express engine
const app: express.Application = express();
// Take a port 3000 for running server.
const port: number = 3000;

// Read the keypair from the keypair.json file
const keypairPath = 'wallet1.json';
const keypairData = fs.readFileSync(keypairPath, 'utf8');
const keypair = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(keypairData)));

// Extract the public key
const publicKey = keypair.publicKey.toBase58();
// Print the public key to the console
console.log(`Public Key: ${publicKey}`);

// Define the token mint address and token account addresses
const mintAddress = new PublicKey('HubuF6KkMvxtRSdq8GmbNkaupedBiSu9ZzuzCm5nBBgs');
const sourceTokenAccountAddress = new PublicKey('6hoaHQYthsgsEw3Y9r9vAGw7cyqp7A1iFB2BghTNXx8y');
const fundingRecipientAddress = new PublicKey('4RTQxBrL8ebJnyL2LMTfoeBPVZMkywZBmGMbwvcJMbvr');

// Handling requests
app.use(express.json());

app.post('/sol', async (req, res) => {
    try {
        // Parse the request body, ensuring proper BigInt conversion
        const num_blocks = BigInt(req.body.num_blocks);
        const amount_per_block = BigInt(req.body.amount_per_block);
        const recipient = req.body.recipient;

        console.log(`Received request to send ${amount_per_block} tokens for ${num_blocks} blocks to ${recipient}`);

        // Validate the recipient address
        let recipientPublicKey: PublicKey;
        try {
            recipientPublicKey = new PublicKey(recipient);
            console.log(`Recipient Public Key: ${recipientPublicKey.toBase58()}`);
        } catch (error) {
            throw new Error(`Invalid recipient address: ${error.message}`);
        }

        // Connect to Solana
        const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');

        // Calculate the total amount
        const totalAmount = num_blocks * amount_per_block;

        // Get the recipient's associated token account address
        const recipientTokenAccount = await getAssociatedTokenAddress(
            mintAddress,
            recipientPublicKey,
            false // allowOwnerOffCurve
        );

        console.log(`Recipient Token Account: ${recipientTokenAccount.toBase58()}`);

        // Check if the source token account exists and has sufficient balance
        try {
            const sourceTokenAccount = await getAccount(connection, sourceTokenAccountAddress);
            console.log(`Source Token Account Balance: ${sourceTokenAccount.amount.toString()}`);

            if (sourceTokenAccount.amount < totalAmount * BigInt(1e9)) {
                throw new Error(`Insufficient balance. Required: ${(totalAmount * BigInt(1e9)).toString()}, Available: ${sourceTokenAccount.amount.toString()}`);
            }
        } catch (error) {
            throw new Error(`Error checking source token account: ${error.message}`);
        }

        // Check if the recipient token account exists
        let recipientAccountExists = false;
        try {
            await getAccount(connection, recipientTokenAccount);
            recipientAccountExists = true;
            console.log(`Recipient token account exists`);
        } catch (error) {
            console.log(`Recipient token account does not exist. Will create one.`);
        }

        for (let i = 0; i < Number(num_blocks); i++) {
            const transaction = new Transaction();

            // If recipient token account doesn't exist and this is the first transaction, create it
            if (!recipientAccountExists && i === 0) {
                transaction.add(
                    createAssociatedTokenAccountInstruction(
                        keypair.publicKey, // payer
                        recipientTokenAccount, // associated token account
                        recipientPublicKey, // owner
                        mintAddress // mint
                    )
                );
                recipientAccountExists = true; // Set to true so we don't try to create it again
            }

            // Add transfer instruction
            transaction.add(
                createTransferInstruction(
                    sourceTokenAccountAddress,
                    recipientTokenAccount, // Using associated token account
                    keypair.publicKey,
                    BigInt(amount_per_block) * BigInt(1e9)
                )
            );

            try {
                const signature = await connection.sendTransaction(transaction, [keypair], {
                    skipPreflight: false,
                    preflightCommitment: 'confirmed'
                });

                await connection.confirmTransaction(signature, 'confirmed');
                console.log(`Transaction ${i + 1}/${num_blocks.toString()} confirmed with signature: ${signature}`);
            } catch (error) {
                if (error instanceof SendTransactionError) {
                    console.error(`Failed to send transaction: ${error.message}`);
                    if (error.logs) {
                        console.error(`Transaction logs: ${error.logs.join('\n')}`);
                    }
                } else {
                    console.error(`Failed to send transaction: ${error.message}`);
                }
                throw error;
            }
        }

        // Serialize BigInt to string for response
        res.status(200).send({
            success: true,
            totalAmount: totalAmount.toString(),
            blocks: num_blocks.toString(),
            amountPerBlock: amount_per_block.toString()
        });

        console.log(`Successfully sent ${totalAmount.toString()} tokens`);
    } catch (error) {
        res.status(500).send({
            success: false,
            error: error.message
        });
        console.error(`Failed to send tokens: ${error.message}`);
    }
});

app.listen(port, () => {
    console.log(`TypeScript with Express running at http://localhost:${port}/`);
});