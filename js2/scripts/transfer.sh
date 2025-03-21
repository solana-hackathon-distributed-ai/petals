# Create a new token mint with the first wallet
TOKEN=$(spl-token create-token --fee-payer wallet3.json)

# Create an associated token account for both wallets
ACCOUNT1=$(spl-token create-account $TOKEN --owner FDXpbvGtYd4DRRC7VTy3U3X57CeSpGVmckP6bM3jM8eu --fee-payer ~/wallet3.json)
#ACCOUNT2=$(spl-token create-account $TOKEN --owner $WALLET2 --fee-payer ~/wallet1.json)

# Mint tokens to the first wallet's associated token account
spl-token mint $TOKEN 100000000000 $ACCOUNT1 --fee-payer ~/wallet3.json

# Transfer tokens from the first wallet's associated token account to the second wallet's associated token account
spl-token transfer $TOKEN 500 14PFzfrwnv5LoYxxUhW56cuCJBjFCfnzcfjbMmvC7aD5 --owner ~/wallet3.json --fee-payer ~/wallet3.json

echo "Token Mint Address: $TOKEN"
echo "Wallet 1 Associated Token Account: $ACCOUNT1"
echo "Minted 100000000000 tokens to Wallet 1's associated token account."
echo "Transferred 500 tokens to Wallet 2's associated token account."