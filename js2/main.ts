import { Connection, clusterApiUrl, Keypair, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import { createMint, getOrCreateAssociatedTokenAccount, mintTo } from '@solana/spl-token';
import { writeFileSync, readFileSync } from 'fs';
import { createCreateMetadataAccountV2Instruction, DataV2 } from '@metaplex-foundation/mpl-token-metadata';
import { sendAndConfirmTransaction, Transaction } from '@solana/web3.js';

// Sleep function for delays
function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Retry function with exponential backoff
async function withRetry<T>(
    fn: () => Promise<T>,
    maxRetries: number = 5, // Increased retries for airdrop
    baseDelayMs: number = 20000 // 20s base delay
): Promise<T> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            if (attempt === maxRetries) break;
            const delay = baseDelayMs * 2 ** (attempt - 1); // 20s, 40s, 80s...
            console.log(`Attempt ${attempt} failed: ${error}. Retrying in ${delay / 1000}s...`);
            await sleep(delay);
        }
    }
    throw new Error(`Failed after ${maxRetries} attempts: ${lastError}`);
}

// Check balance and log it
async function checkBalance(connection: Connection, publicKey: PublicKey): Promise<number> {
    const balance = await connection.getBalance(publicKey);
    console.log(`Payer balance: ${balance / LAMPORTS_PER_SOL} SOL`);
    return balance;
}

async function ensureFunds(connection: Connection, payer: Keypair, minBalance: number = LAMPORTS_PER_SOL / 10) {
    let balance = await checkBalance(connection, payer.publicKey);
    let attempt = 0;
    const maxAttempts = 5;

    while (balance < minBalance && attempt < maxAttempts) {
        console.log(`Insufficient funds (${balance / LAMPORTS_PER_SOL} SOL). Requesting airdrop...`);
        await withRetry(async () => {
            const airdropSignature = await connection.requestAirdrop(payer.publicKey, LAMPORTS_PER_SOL);
            await connection.confirmTransaction(airdropSignature);
            console.log('Airdrop requested:', airdropSignature);
        }, 5, 30000); // 30s base delay for airdrop retries
        await sleep(20000); // Wait 20s for funds to settle
        balance = await checkBalance(connection, payer.publicKey);
        attempt++;
    }

    if (balance < minBalance) {
        throw new Error(`Failed to acquire sufficient funds after ${maxAttempts} attempts`);
    }
    console.log('Funds secured:', balance / LAMPORTS_PER_SOL, 'SOL');
}

async function createTestToken() {
    // Switch to devnet for better airdrop reliability
    const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');
    let payer: Keypair;

    try {
        // Load or generate payer keypair
        try {
            const secretKey = Uint8Array.from(JSON.parse(readFileSync('keypair.json', 'utf8')));
            payer = Keypair.fromSecretKey(secretKey);
            console.log('Loaded existing keypair');
        } catch {
            payer = Keypair.generate();
            writeFileSync('keypair.json', JSON.stringify(Array.from(payer.secretKey)));
            console.log('Generated new keypair');
        }

        // Ensure funds are available (automated airdrop loop)
        await ensureFunds(connection, payer);

        // Create mint with retry
        const mint = await withRetry(async () => {
            const result = await createMint(
                connection,
                payer,
                payer.publicKey,
                payer.publicKey,
                9
            );
            console.log('Mint created:', result.toBase58());
            return result;
        });
        await sleep(5000);

        // Get or create token account with retry
        const tokenAccount = await withRetry(async () => {
            const result = await getOrCreateAssociatedTokenAccount(connection, payer, mint, payer.publicKey);
            console.log('Token Account:', result.address.toBase58());
            return result;
        });
        await sleep(5000);

        // Mint tokens with retry
        await withRetry(async () => {
            await mintTo(connection, payer, mint, tokenAccount.address, payer, 10000000000000 * 10 ** 9);
            console.log('Minted 1000 tokens');
        });
        await sleep(5000);

        // Create metadata for the token
        const metadataPDA = await PublicKey.findProgramAddress(
            [
                Buffer.from('metadata'),
                new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s').toBuffer(),
                mint.toBuffer(),
            ],
            new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s')
        );

        const metadataData: DataV2 = {
            name: "My Token",
            symbol: "MTK",
            uri: "https://example.com/token-metadata.json", // Replace with your metadata URI
            sellerFeeBasisPoints: 0,
            creators: "",
            collection: null,
            uses: null,
        };

        const createMetadataIx = createCreateMetadataAccountV2Instruction(
            {
                metadata: metadataPDA[0],
                mint,
                mintAuthority: payer.publicKey,
                payer: payer.publicKey,
                updateAuthority: payer.publicKey,
            },
            {
                createMetadataAccountArgsV2: {
                    data: metadataData,
                    isMutable: true,
                },
            }
        );

        const tx = new Transaction().add(createMetadataIx);
        await sendAndConfirmTransaction(connection, tx, [payer]);

        console.log('Metadata created for token');

        return { mintAddress: mint.toBase58(), tokenAccountAddress: tokenAccount.address.toBase58() };
    } catch (err) {
        if (err instanceof Error && 'logs' in err) {
            console.error('Detailed logs:', (err as any).logs);
        }
        throw new Error(`Failed to create test token: ${err}`);
    }
}

createTestToken()
    .then(result => console.log('Success:', result))
    .catch(err => console.error('Failed:', err));
