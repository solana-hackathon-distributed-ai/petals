
first set up conda and cuda

install rust curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

rustup install 1.60.0
rustup default 1.60.0

sudo apt install libonig-dev && libzstd-dev && libbz2-dev && nvidia-cuda-toolkit && python3-dev

pip install -r requirements.txt


huggingface-cli login

python(or python3 if linux) src\petals\cli\run_server.py bigscience/bloom-560m
