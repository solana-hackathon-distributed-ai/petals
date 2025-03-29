import { createMint, mplToolbox } from "@metaplex-foundation/mpl-toolbox";
import { Connection, clusterApiUrl, Keypair, PublicKey } from "@solana/web3.js";
import { Transaction, SystemProgram } from "@solana/web3.js";
import fs from "fs";

// Load the wallet from a keypair file
const keypairFile = './wallet-keypair.json';
if (!fs.existsSync(keypairFile)) {
    throw new Error(`Keypair file not found: ${keypairFile}`);
}
const secretKey = Uint8Array.from(JSON.parse(fs.readFileSync(keypairFile, 'utf-8')));
const wallet = Keypair.fromSecretKey(secretKey);

// Initialize connection
const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');

// Define your token metadata
const tokenMintAddress = new PublicKey("HubuF6KkMvxtRSdq8GmbNkaupedBiSu9ZzuzCm5nBBgs");
const tokenMetadata = {
    name: "aicrunch",
    symbol: "aicrunch",
    uri: "https://raw.githubusercontent.com/solana-hackathon-distributed-ai/petals/refs/heads/main/js2/token.json",
    creators: [{ address: wallet.publicKey.toBase58(), share: 100 }],
};

// Add metadata to the token
async function addMetadata() {
    try {
        const toolbox = mplToolbox(connection);

        const transaction = new Transaction();
        const metadataAccount = toolbox.metadata.create({
            mint: tokenMintAddress,
            name: tokenMetadata.name,
            symbol: tokenMetadata.symbol,
            uri: tokenMetadata.uri,
            creators: tokenMetadata.creators,
            updateAuthority: wallet.publicKey,
            payer: wallet.publicKey,
        });

        transaction.add(metadataAccount);
        transaction.add(
            SystemProgram.transfer({
                fromPubkey: wallet.publicKey,
                toPubkey: metadataAccount.publicKey,
                lamports: await connection.getMinimumBalanceForRentExemption(metadataAccount.data.byteLength),
            })
        );

        // Sign and send the transaction
        const signature = await connection.sendTransaction(transaction, [wallet]);
        console.log(`✅ Metadata added! View transaction: https://explorer.solana.com/tx/${signature}?cluster=devnet`);
    } catch (error) {
        console.error("❌ Error adding metadata:", error.message);
    }
}

// Execute the function
addMetadata();
