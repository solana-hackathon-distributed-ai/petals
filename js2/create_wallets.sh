#!/bin/bash

# Exit on any error
set -e

# Set the Solana CLI config to use the devnet
solana config set --url https://api.devnet.solana.com

# Create two wallets
solana-keygen new --outfile ./wallet1.json --no-bip39-passphrase
solana-keygen new --outfile ./wallet2.json --no-bip39-passphrase

# Get the public keys of the wallets
WALLET1=$(solana-keygen pubkey ./wallet1.json)
WALLET2=$(solana-keygen pubkey ./wallet2.json)


