# Create a new token mint with the first wallet
TOKEN=$(spl-token create-token --fee-payer wallet1.json)

# Create an associated token account for both wallets
ACCOUNT1=$(spl-token create-account $TOKEN --owner 8qYPuLNmnVgmLfR7ZGon7jfnSmNCr2MUHA9sUnfJseU3 --fee-payer ~/wallet1.json)
#ACCOUNT2=$(spl-token create-account $TOKEN --owner $WALLET2 --fee-payer ~/wallet1.json)

# Mint tokens to the first wallet's associated token account
spl-token mint $TOKEN 100000000000 $ACCOUNT1 --fee-payer ~/wallet1.json

# Transfer tokens from the first wallet's associated token account to the second wallet's associated token account
spl-token transfer $TOKEN 1 $WALLET2 --owner ~/wallet1.json --fee-payer ~/wallet1.json

echo "Wallet 1 Public Key: $WALLET1"
echo "Wallet 2 Public Key: $WALLET2"
echo "Token Mint Address: $TOKEN"
echo "Wallet 1 Associated Token Account: $ACCOUNT1"
echo "Minted 100000000000 tokens to Wallet 1's associated token account."
echo "Transferred 500 tokens to Wallet 2's associated token account."