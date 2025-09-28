// CommonJS require statements
const {
    Connection,
    clusterApiUrl,
    Keypair,
    PublicKey,
    Transaction,
    SendTransactionError
} = require('@solana/web3.js');
const {
    createTransferInstruction,
    getAccount,
    getAssociatedTokenAddress,
    createAssociatedTokenAccountInstruction
} = require('@solana/spl-token');
const fs = require('fs');
const express = require('express');

// Initialize the express engine
const app = express();
// Take a port 3000 for running server.
const port = 1234;

// Read the keypair from the keypair.json file
const keypairPath = 'wallet1.json';
const keypairData = fs.readFileSync(keypairPath, 'utf8');
const keypair = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(keypairData)));

// Extract the public key
const publicKey = keypair.publicKey.toBase58();
// Print the public key to the console
console.log(`Public Key: ${publicKey}`);

// Define the token mint address and token account addresses
const mintAddress = new PublicKey('AFKBPXp6G8n7Ffj5ehuDaDqcwmxNARSyAJiy5WZBxxGk');
const sourceTokenAccountAddress = new PublicKey('DtrDHDzMc6spiJCPe5FV4XrDUqSkaHF3r75iFBTBA2eZ');
const fundingRecipientAddress = new PublicKey('ZP1TWSPHa3uZUTrWdRYQ3i7V7pjaQBnGNM42ghzLDUiVapMpMTqN3s4bvciTKRBpTD3tMvGsBVQxfk2DvtaM1S7');

// Fixed recipient address
const fixedRecipientAddress = new PublicKey('8qYPuLNmnVgmLfR7ZGon7jfnSmNCr2MUHA9sUnfJseU3');
// Handling requests
app.use(express.json());

// ====================================================================
// /sol Endpoint
// ====================================================================

app.post('/sol', async (req, res) => {
    try {
        // Parse the request body, ensuring proper BigInt conversion
        // Note: BigInt is part of standard JavaScript now
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
            // Check if error is a NodeError, otherwise assume it's a standard Error
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new Error(`Invalid recipient address: ${errorMessage}`);
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
        const errorMessage = error instanceof Error ? error.message : String(error);
        res.status(500).send({
            success: false,
            error: errorMessage
        });
        console.error(`Failed to send tokens: ${errorMessage}`);
    }
});

// ====================================================================
// /chat Endpoint
// ====================================================================

app.post('/chat', async (req, res) => {
    try {
        const source = req.body.source; // Source token account address from JSON

        // Validate the source address from the JSON and derive the Associated Token Account
        let sourceTokenAccountAddress;
        try {
            sourceTokenAccountAddress = await getAssociatedTokenAddress(
                mintAddress,
                new PublicKey(source),
                false // allowOwnerOffCurve if necessary
            );

            console.log(`Source Token Account: ${sourceTokenAccountAddress.toBase58()}`);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new Error(`Invalid source address: ${errorMessage}`);
        }

        // Use the fixed recipient address
        const recipientPublicKey = fixedRecipientAddress;
        console.log(`Fixed Recipient Public Key: ${recipientPublicKey.toBase58()}`);

        // Connect to Solana
        const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');

        // Calculate the total amount to be transferred
        const num_blocks = 1;
        const totalAmount = BigInt(num_blocks);


        // Get the recipient's associated token account address
        const recipientTokenAccount = await getAssociatedTokenAddress(
            mintAddress,
            recipientPublicKey,
            false // allowOwnerOffCurve
        );
        console.log(`Recipient Token Account: ${recipientTokenAccount.toBase58()}`);

        // Check if the source token account exists and has sufficient balance
        try {
            const sourceAccount = await getAccount(connection, sourceTokenAccountAddress);
            console.log(`Source Token Account Balance: ${sourceAccount.amount.toString()}`);

            if (sourceAccount.amount < totalAmount * BigInt(1e9)) {
                throw new Error(`Insufficient balance. Required: ${(totalAmount * BigInt(1e9)).toString()}, Available: ${sourceAccount.amount.toString()}`);
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

        // Process transaction
        const transaction = new Transaction();

        // If recipient token account doesn't exist, create it.
        if (!recipientAccountExists) {
            transaction.add(
                createAssociatedTokenAccountInstruction(
                    keypair.publicKey,       // payer
                    recipientTokenAccount,   // associated token account
                    fixedRecipientAddress,   // owner
                    mintAddress              // mint
                )
            );
            recipientAccountExists = true;
        }

        // Add transfer instruction
        transaction.add(
            createTransferInstruction(
                sourceTokenAccountAddress,
                recipientTokenAccount,       // Using the recipient's associated token account
                keypair.publicKey,
                totalAmount * BigInt(1e9),   // Amount to transfer (in raw units)
            )
        );

        try {
            const signature = await connection.sendTransaction(transaction, [keypair], {
                skipPreflight: false,
                preflightCommitment: 'confirmed'
            });
            await connection.confirmTransaction(signature, 'confirmed');
            console.log(`Transaction confirmed with signature: ${signature}`);
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


        // Return response with transaction details.
        res.status(200).send({
            success: true,
            totalAmount: totalAmount.toString(),

        });

        console.log(`Successfully sent ${totalAmount.toString()} tokens`);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        res.status(500).send({
            success: false,
            error: errorMessage
        });
        console.error(`Failed to send tokens: ${errorMessage}`);
    }
});

app.listen(port, () => {
    console.log(`CommonJS with Express running at http://localhost:${port}/`);
});
