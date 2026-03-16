# Assets

This directory contains static assets for the DecentCalendar vanilla app.

## Included Files

| File | Source | Description |
|------|--------|-------------|
| `SecretPyramid.gif` | Copied from `../decent-calendar-react-app/src/assets/` | Animated background |
| `Metamask_Logo.png` | Copied from `../decent-calendar-react-app/src/assets/` | MetaMask wallet logo |
| `Ommm_Token_Logo.png` | Copied from `../decent-calendar-react-app/src/assets/` | Ommm token logo |
| `DecentSmartHome_Logo.png` | Copied from `../decent-calendar-react-app/src/assets/` | DecentSmartHome logo |

These files are copied directly from the React app's assets folder so that the vanilla app
is fully self-contained and can be served from any static host or IPFS gateway.

## Assets Required (source externally)

The following assets are referenced by the Web Component layer but need to be
sourced or created separately before the IPFS Waiting Modal icon ring is fully rendered:

| File | Used In | Description |
|---|---|---|
| `IPFS_Logo.png` | `IPFSWaitingModal.js` icon ring | IPFS / Kubo logo |
| `IPFS_Companion.gif` | Future IPFS status animation | IPFS Companion browser extension GIF |
| `Web3Storage.png` | Future Web3.Storage integration | Web3.Storage logo |

### Where to get them

- **IPFS_Logo.png** — Download from [https://ipfs.tech/media/](https://ipfs.tech/media/)
- **IPFS_Companion.gif** — From the [IPFS Companion browser extension repository](https://github.com/ipfs/ipfs-companion)
- **Web3Storage.png** — From [https://web3.storage](https://web3.storage) branding assets

Until these files are added, the icon ring in the IPFS Waiting Modal will show
broken-image placeholders for those slots (the modal itself remains fully functional).

