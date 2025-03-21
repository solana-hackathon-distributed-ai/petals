#!/bin/bash

# Exit on any error
#set -e

# Set the Solana CLI config to use the devnet
solana config set --url https://api.devnet.solana.com

# Create two wallets
solana-keygen new --outfile ./wallet1.json --no-bip39-passphrase
solana-keygen new --outfile ./wallet2.json --no-bip39-passphrase

# Create two wallets
solana-keygen new  --word-count 12  --outfile ./wallet3.json 
solana-keygen new --word-count 12 --outfile  ./wallet4.json 

# Get the public keys of the wallets
WALLET1=$(solana-keygen pubkey ./wallet3.json)
WALLET2=$(solana-keygen pubkey ./wallet4.json)


