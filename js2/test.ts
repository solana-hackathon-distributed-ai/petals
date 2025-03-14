import { getOrCreateAssociatedTokenAccount, createTransferInstruction } from "@solana/spl-token";
import pkg from '@solana/web3.js';
const { Connection, Keypair, ParsedAccountData, PublicKey, sendAndConfirmTransaction, Transaction } = pkg;
import { readFileSync } from 'fs';

/**
 * Creating connection with solana network
 */
const endpoint = 'https://api.devnet.solana.com/';
const solanaConnection = new Connection(endpoint);

// Read and parse the keypair.json file
const secret = JSON.parse(readFileSync('keypair.json', 'utf8'));

// Create a Uint8Array from the secret array
const secretKey = new Uint8Array(secret);

// Create a Keypair from the secret key
const FROM_KEYPAIR = Keypair.fromSecretKey(secretKey);

console.log('Keypair created:', FROM_KEYPAIR.publicKey.toBase58());

/**
 * Defining KeyPair and mint address
 */
const MINT_ADDRESS = 'CXmpGDEA8Ddoe9z25gTxqjhjzeTaDnmjyTZMSAiPeabF'; // Correct mint address with balance

/**
 * Method to fetch the number of decimals for the mint
 * @param mintAddress 
 * @returns 
 */
async function getNumberDecimals(mintAddress: string): Promise<number> {
    const info = await solanaConnection.getParsedAccountInfo(new PublicKey(mintAddress));
    const result = (info.value?.data as ParsedAccountData).parsed.info.decimals as number;
    return result;
}

/**
 * Method to send tokens to destination_Wallet
 * @param destination_Wallet 
 * @param transfer_Amount 
 */
async function sendTokens(destination_Wallet: string, transfer_Amount: number) {
    try {
        console.log(`Sending ${transfer_Amount} tokens from ${FROM_KEYPAIR.publicKey.toString()} to ${destination_Wallet}.`);

        // Step 1: Get Source Token Account
        console.log(`1 - Getting Source Token Account`);
        let sourceAccount = await getOrCreateAssociatedTokenAccount(
            solanaConnection,
            FROM_KEYPAIR,
            new PublicKey(MINT_ADDRESS),
            FROM_KEYPAIR.publicKey
        );
        console.log(`    Source Account: ${sourceAccount.address.toString()}`);

        // Step 2: Get Destination Token Account
        console.log(`2 - Getting Destination Token Account`);
        let destinationAccount = await getOrCreateAssociatedTokenAccount(
            solanaConnection,
            FROM_KEYPAIR,
            new PublicKey(MINT_ADDRESS),
            new PublicKey(destination_Wallet)
        );
        console.log(`    Destination Account: ${destinationAccount.address.toString()}`);

        // Step 3: Fetch Number of Decimals for Mint
        console.log(`3 - Fetching Number of Decimals for Mint: ${MINT_ADDRESS}`);
        const numberDecimals = await getNumberDecimals(MINT_ADDRESS);
        console.log(`    Number of Decimals: ${numberDecimals}`);

        // Step 4: Create and Send Transaction
        console.log(`4 - Creating and Sending Transaction`);
        const tx = new Transaction();
        tx.add(createTransferInstruction(
            sourceAccount.address,
            destinationAccount.address,
            FROM_KEYPAIR.publicKey,
            transfer_Amount * Math.pow(10, numberDecimals)
        ));

        const latestBlockHash = await solanaConnection.getLatestBlockhash('confirmed');
        tx.recentBlockhash = latestBlockHash.blockhash;
        const signature = await sendAndConfirmTransaction(solanaConnection, tx, [FROM_KEYPAIR]);
        console.log(
            '\x1b[32m', // Green Text
            `   Transaction Success!🎉`,
            `\n    https://explorer.solana.com/tx/${signature}?cluster=devnet`
        );
    } catch (error) {
        console.error(`Failed to send tokens: ${error.message}`);
    }
}

sendTokens("7KPGDuQtgox24zsfdm86HjizGxEncZtUpzu5BuNywnsV", 1);







