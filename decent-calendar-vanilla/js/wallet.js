/* wallet.js — MetaMask connection and wallet state management */

const walletState = {
  address: null,
  provider: null,
  signer: null,
};

async function connectWallet() {
  if (!window.ethereum) {
    alert('MetaMask not detected. Please install MetaMask.');
    return;
  }
  try {
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    walletState.address = accounts[0];
    walletState.provider = new ethers.BrowserProvider(window.ethereum);
    walletState.signer = await walletState.provider.getSigner();
    updateWalletUI();
    await checkNetwork();
    onWalletConnected();
  } catch (err) {
    console.error('Wallet connection error:', err);
    alert('Failed to connect wallet.');
  }
}

async function checkNetwork() {
  try {
    const network = await walletState.provider.getNetwork();
    const chainId = Number(network.chainId);
    // Polygon mainnet (137) or Amoy testnet (80002) or Mumbai (80001)
    if (chainId !== 137 && chainId !== 80001 && chainId !== 80002) {
      const switchConfirm = confirm('This app runs on Polygon. Switch network now?');
      if (switchConfirm) {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0x89' }], // Polygon mainnet
        });
      }
    }
  } catch (err) {
    console.warn('Network check failed:', err);
  }
}

function disconnectWallet() {
  walletState.address = null;
  walletState.provider = null;
  walletState.signer = null;
  updateWalletUI();
  onWalletDisconnected();
}

function updateWalletUI() {
  const prompt = document.getElementById('connect-prompt');
  const addrStart = document.getElementById('wallet-address-start');
  const addrEnd = document.getElementById('wallet-address-end');
  const walletInfo = document.getElementById('wallet-info');
  const walletBtn = document.getElementById('wallet-btn');

  if (walletState.address) {
    prompt.classList.add('hidden');
    walletInfo.classList.remove('hidden');
    addrStart.textContent = walletState.address.slice(0, 6);
    addrEnd.textContent = walletState.address.slice(-4);
    walletBtn.title = 'Click to disconnect';
  } else {
    prompt.classList.remove('hidden');
    walletInfo.classList.add('hidden');
    walletBtn.title = 'Connect MetaMask';
  }
}

// Listen for account changes in MetaMask
if (window.ethereum) {
  window.ethereum.on('accountsChanged', (accounts) => {
    if (accounts.length === 0) {
      disconnectWallet();
    } else {
      walletState.address = accounts[0];
      walletState.provider = new ethers.BrowserProvider(window.ethereum);
      walletState.provider.getSigner().then((signer) => {
        walletState.signer = signer;
        updateWalletUI();
        onWalletConnected();
      });
    }
  });

  window.ethereum.on('chainChanged', () => {
    window.location.reload();
  });
}
