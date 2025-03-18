# How to install

sudo apt install libudev-dev libhidapi-dev autoconf automake libtool libusb-1.0-0-dev libc6-dev cmake
export C_INCLUDE_PATH=/usr/include:/usr/include/x86_64-linux-gnu/
cargo install agave-install
agave-install init 2.1.15
solana config set --url https://api.devnet.solana.com
rustup install nightly
rustup override set nightly

# Using Anchor Framework

1. Install Anchor CLI:
cd contracts/src
1. anchor build
2. anchor deploy