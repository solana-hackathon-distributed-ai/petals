// CommonJS require statements
const {
    Connection,
    clusterApiUrl,
    Keypair,
    PublicKey,
    Transaction,
    SendTransactionError
} = require('@solana/web3.js');

// Import all functions from the SPL-Token library into a single object (Fixes 'getAssociatedTokenAddress is not a function')
const splToken = require('@solana/spl-token');

// Then, manually reference the functions from the splToken object
const { 
  getAssociatedTokenAddress,
  createTransferInstruction,
  getAccount,
  createAssociatedTokenAccountInstruction
} = require('@solana/spl-token');

// 🚨 REMOVED: const getAssociatedTokenAddress = splToken.getAssociatedTokenAddress; 
// We will call splToken.getAssociatedTokenAddress directly to avoid CJS binding issues.
const fs = require('fs');
const express = require('express');

// Initialize the express engine
const app = express();
const port = 1234;

// Global variables defined but not initialized yet
let keypair;
let publicKey;
let mintAddress;
let sourceTokenAccountAddress;
let fixedRecipientAddress;

// Handling requests
app.use(express.json());

// ====================================================================
// ASYNCHRONOUS INITIALIZATION FUNCTION
// ====================================================================
async function main() {
    try {
        // --- 1. Load Keypair ---
        const keypairPath = 'keypair.json';
        const keypairData = fs.readFileSync(keypairPath, 'utf8');
        keypair = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(keypairData)));
        
        publicKey = keypair.publicKey.toBase58();
        console.log(`Public Key (Server Signer): ${publicKey}`);

        // --- 2. Define Public Keys ---
        // 🚨 FIX 1: Using a valid Mint Address.
        mintAddress = new PublicKey('AFKBPXp6G8n7Ffj5ehuDaDqcwmxNARSyAJiy5WZBxxGk');
        
        // 🚨 FIX 2: Fixed recipient address (Wallet Public Key, NOT an ATA)
        fixedRecipientAddress = new PublicKey('8qYPuLNmnVgmLfR7ZGon7jfnSmNCr2MUHA9sUnfJseU3');

        // --- 3. Await Asynchronous Derivation (Requires async function) ---
        // This is the Associated Token Account (ATA) where the tokens live for the signing wallet.
        sourceTokenAccountAddress = await getAssociatedTokenAddress( // 🚨 FIX: Using splToken.getAssociatedTokenAddress
            mintAddress,  // The Mint
            keypair.publicKey, // The Owner (The server's wallet)
            false
        );
        console.log(`Source Token Account (ATA): ${sourceTokenAccountAddress.toBase58()}`);
        console.log(`Mint Address: ${mintAddress.toBase58()}`);


        // --- 4. Start Server ---
        app.listen(port, () => {
            console.log(`\n✅ Server Running at http://localhost:${port}/`);
            console.log('Server is ready to process token transfers.');
        });

    } catch (error) {
        console.error("CRITICAL ERROR during server setup:");
        console.error(error);
        process.exit(1); // Exit if setup fails
    }
}

// ====================================================================
// /sol Endpoint
// ====================================================================

app.post('/sol', async (req, res) => {
    // Ensure all necessary global variables are initialized
    if (!keypair || !mintAddress || !sourceTokenAccountAddress) {
        return res.status(500).send({
            success: false,
            error: "Server initialization incomplete. Try again later."
        });
    }

    try {
        // Parse the request body, ensuring proper BigInt conversion
        const num_blocks = BigInt(req.body.num_blocks);
        const amount_per_block = BigInt(req.body.amount_per_block);
        const recipient = req.body.recipient;

        console.log(`Received request to send ${amount_per_block} tokens for ${num_blocks} blocks to ${recipient}`);

        // Validate the recipient address
        let recipientPublicKey;
        try {
            recipientPublicKey = new PublicKey(recipient);
            console.log(`Recipient Public Key: ${recipientPublicKey.toBase58()}`);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new Error(`Invalid recipient address: ${errorMessage}`);
        }

        // Connect to Solana
        const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');

        // Calculate the total amount
        const totalAmount = num_blocks * amount_per_block;

        // Get the recipient's associated token account address (derived from their wallet key)
        const recipientTokenAccount = await getAssociatedTokenAddress( // 🚨 FIX: Using splToken.getAssociatedTokenAddress
            mintAddress,
            recipientPublicKey,
            false // allowOwnerOffCurve
        );

        console.log(`Recipient Token Account (ATA): ${recipientTokenAccount.toBase58()}`);

        // Check if the source token account exists and has sufficient balance
        try {
            const sourceTokenAccount = await getAccount(connection, sourceTokenAccountAddress);
            console.log(`Source Token Account Balance: ${sourceTokenAccount.amount.toString()}`);

            // 1e9 is used for decimals (assuming 9 decimals, which is standard)
            if (sourceTokenAccount.amount < totalAmount * BigInt(1e9)) {
                throw new Error(`Insufficient balance. Required: ${(totalAmount * BigInt(1e9)).toString()}, Available: ${sourceTokenAccount.amount.toString()}`);
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new Error(`Error checking source token account: ${errorMessage}`);
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
            const amountInLamports = BigInt(amount_per_block) * BigInt(1e9);

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
                    sourceTokenAccountAddress, // Server's ATA
                    recipientTokenAccount,     // Recipient's ATA
                    keypair.publicKey,         // Owner/Authority (The server signer)
                    amountInLamports
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
        const errorMessage = error instanceof Error ? error.message : String(error);
        res.status(500).send({
            success: false,
            error: errorMessage
        });
        console.error(`Failed to send tokens in /sol: ${errorMessage}`);
    }
});

// ====================================================================
// /chat Endpoint (Uses fixedRecipientAddress)
// ====================================================================

app.post('/chat', async (req, res) => {
    if (!keypair || !mintAddress || !sourceTokenAccountAddress) {
        return res.status(500).send({
            success: false,
            error: "Server initialization incomplete. Try again later."
        });
    }

    try {
        const source = req.body.source;
        const amount_to_transfer = BigInt(req.body.amount_to_transfer);

        console.log(`Sending ${amount_to_transfer.toString()} tokens from source ${source} to fixed recipient.`);

        const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');

        // --- Fetch mint info for decimals ---
        const mintInfo = await splToken.getMint(connection, mintAddress);
        const decimals = mintInfo.decimals;
        const amountInBaseUnits = amount_to_transfer * BigInt(10 ** decimals);

        console.log(`Amount in base units: ${amountInBaseUnits.toString()}`);

        const recipientPublicKey = fixedRecipientAddress;
        const recipientTokenAccount = await getAssociatedTokenAddress(
            mintAddress,
            recipientPublicKey,
            false
        );
        console.log(`Recipient ATA: ${recipientTokenAccount.toBase58()}`);

        // Check source balance
        const sourceAccount = await getAccount(connection, sourceTokenAccountAddress);
        if (sourceAccount.amount < amountInBaseUnits) {
            throw new Error(`Insufficient balance. Required: ${amountInBaseUnits}, Available: ${sourceAccount.amount}`);
        }

        // Check if recipient ATA exists
        let recipientAccountExists = true;
        try {
            await getAccount(connection, recipientTokenAccount);
        } catch {
            recipientAccountExists = false;
            console.log("Recipient ATA doesn't exist. Will create.");
        }

        const transaction = new Transaction();
        if (!recipientAccountExists) {
            transaction.add(
                createAssociatedTokenAccountInstruction(
                    keypair.publicKey,       // payer
                    recipientTokenAccount,   // ATA
                    recipientPublicKey,      // owner
                    mintAddress
                )
            );
        }

        transaction.add(
            createTransferInstruction(
                sourceTokenAccountAddress,
                recipientTokenAccount,
                keypair.publicKey,
                amountInBaseUnits
            )
        );

        const signature = await connection.sendTransaction(transaction, [keypair], {
            skipPreflight: false,
            preflightCommitment: 'confirmed'
        });
        await connection.confirmTransaction(signature, 'confirmed');

        res.status(200).send({
            success: true,
            amountTransferred: amount_to_transfer.toString(),
            recipient: fixedRecipientAddress.toBase58(),
            signature
        });

        console.log(`Successfully sent ${amount_to_transfer.toString()} tokens, tx: ${signature}`);

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        res.status(500).send({ success: false, error: errorMessage });
        console.error(`Failed to send tokens in /chat: ${errorMessage}`);
    }
});

// Run the main async function to initialize globals and start the server
main();

