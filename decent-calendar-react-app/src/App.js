import React, { useState } from 'react';
import Calendar from './Calendar';
import './App.css';
import MetamaskLogo from './assets/Metamask_Logo.png'; 
import OmmmTokenLogo from './assets/Ommm_Token_Logo.png';
import DecentSmartHomeLogo from './assets/DecentSmartHome_Logo.png';


function App() {
  const [walletAddress, setWalletAddress] = useState('');

  const connectWallet = async () => {
    if (window.ethereum) {
      try {
        const accounts = await window.ethereum.request({
          method: 'eth_requestAccounts',
        });
        setWalletAddress(accounts[0]);
      } catch (error) {
        console.error('Wallet connection error:', error);
        alert('Failed to connect wallet. Please try again.');
      }
    } else {
      alert('MetaMask not detected. Please install MetaMask to continue.');
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <div className="wallet-info">
          {walletAddress ? (
            <div className="wallet-address-container">
              <span className="wallet-address-part">
                {walletAddress.slice(0, 6)}
              </span>
              <div className="wallet-icons">
                <img src={OmmmTokenLogo} alt="Icon 1" className="icon-small" />
                <img src={MetamaskLogo} alt="Icon 2" className="icon-small" />
                <img src={DecentSmartHomeLogo} alt="Icon 3" className="icon-small" />
                <img src={MetamaskLogo} alt="Icon 4" className="icon-small" />
                <img src={OmmmTokenLogo} alt="Icon 5" className="icon-small" />
              </div>
              <span className="wallet-address-part">
                {walletAddress.slice(-4)}
              </span>
            </div>
          ) : (
            <h2 className="wallet-address neon-text">
              Connect Wallet to Begin
            </h2>
          )}
        </div>
        <button className="wallet-button" onClick={connectWallet}>
          <img src={MetamaskLogo} alt="MetaMask Logo" className="wallet-logo" />
        </button>
      </header>
      <main>
        <Calendar walletAddress={walletAddress} />
      </main>
      <footer className="App-footer">
        <p>
        <img src={DecentSmartHomeLogo} alt="Icon 4" className="icon-small" />
        <img src={OmmmTokenLogo} alt="Icon 4" className="icon-small" />
          Another creation by A Decent Agency to help the world be on the same page.
        <img src={OmmmTokenLogo} alt="Icon 4" className="icon-small" />
        <img src={DecentSmartHomeLogo} alt="Icon 4" className="icon-small" />
        </p>
      </footer>
    </div>
  );
  
}

export default App;