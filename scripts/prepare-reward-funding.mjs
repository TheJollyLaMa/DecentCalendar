import { Contract, Interface, JsonRpcProvider, keccak256 } from 'ethers';
import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

export const ESCROW = '0x31b07b83e99A9bdF379bf40225b8A80d3804C89d';
export const NFT = '0xe63EC9f8228720bAAC2fD528C0A6d06B3Dc5439B';
export const OWNER = '0x807061DF657A7697c04045dA7d16D941861cAABc';
const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const ABI = [
  'function owner() view returns(address)',
  'function listings(uint256) view returns(address nftContract,uint256 tokenId,uint256 priceETH,address priceToken,uint256 priceAmount,uint256 available,bool active,string note)',
  'function nextListingId() view returns(uint256)',
  'function delistDNFT(uint256)',
  'function withdrawNFT(address,uint256,uint256,address)',
  'function listDNFT(address,uint256,uint256,address,uint256,uint256,string) returns(uint256)',
];
const same = (a,b) => a.toLowerCase() === b.toLowerCase();
export function fundingStep({ listing, escrowStock, giftStock, activeListings, vault }) {
  if (!same(listing.nftContract,NFT) || listing.tokenId !== 77n || listing.priceETH !== 0n ||
      !same(listing.priceToken,USDC) || listing.priceAmount !== 10000000n ||
      listing.available !== 900n) throw new Error('Original listing changed; review live stock and terms before reallocating.');
  const tx = (method,args) => ({ from:OWNER, to:ESCROW, value:'0x0', chainId:8453,
    method, args:args.map(x=>typeof x==='bigint'?String(x):x), data:new Interface(ABI).encodeFunctionData(method,args) });
  if (listing.active) {
    if (activeListings.length !== 1 || activeListings[0].id !== 15n || escrowStock !== 900n || giftStock !== 0n)
      throw new Error('Initial inventory or competing listing changed; do not proceed.');
    return tx('delistDNFT',[15n]);
  }
  if (escrowStock === 900n && giftStock === 0n && activeListings.length === 0)
    return tx('withdrawNFT',[NFT,77n,10n,vault]);
  if (escrowStock === 890n && giftStock === 10n && activeListings.length === 0)
    return tx('listDNFT',[NFT,77n,0n,USDC,10000000n,890n,listing.note]);
  if (escrowStock === 890n && giftStock === 10n && activeListings.length === 1) {
    const replacement = activeListings[0];
    if (replacement.id !== 15n && replacement.available === 890n &&
        replacement.priceETH === 0n && same(replacement.priceToken,USDC) &&
        replacement.priceAmount === 10000000n && replacement.note === listing.note)
      return { complete:true, listingId:String(replacement.id) };
  }
  throw new Error('Unexpected cutover state; reconcile receipts before any new transaction.');
}
export async function prepareRewardFunding(rpc='https://mainnet.base.org') {
  const record = JSON.parse(await readFile(new URL('../docs/deployments/base-dcal-booking-rewards-1.json',import.meta.url),'utf8'));
  const p = new JsonRpcProvider(rpc,8453,{staticNetwork:true});
  try {
    if (BigInt(await p.send('eth_chainId',[])) !== 8453n) throw new Error('Funding requires Base.');
    const block = await p.getBlockNumber(), opts={blockTag:block}, vault=record.address;
    if (keccak256(await p.getCode(vault,block)) !== record.runtimeCodeHash) throw new Error('Gift vault runtime mismatch.');
    const receipt=await p.getTransactionReceipt(record.transaction);
    if (!receipt || receipt.status!==1 || !same(receipt.contractAddress || '',vault)) throw new Error('Vault deployment receipt mismatch.');
    const reward=new Contract(vault,['function enabled() view returns(bool)','function startAppointmentId() view returns(uint256)','function awarded() view returns(uint256)'],p);
    if (await reward.enabled(opts) || await reward.startAppointmentId(opts)!==0n || await reward.awarded(opts)!==0n)
      throw new Error('Promotion already activated; funding requires a separate review.');
    const escrow=new Contract(ESCROW,ABI,p);
    if (!same(await escrow.owner(opts),OWNER)) throw new Error('Escrow owner changed.');
    const nft=new Contract(NFT,['function balanceOf(address,uint256) view returns(uint256)'],p);
    const listing=await escrow.listings(15n,opts), activeListings=[], next=await escrow.nextListingId(opts);
    if (next>1000n) throw new Error('Listing scan exceeds reviewed bound.');
    for (let id=0n;id<next;id++) {
      await new Promise(r=>setTimeout(r,150));
      const item=await escrow.listings(id,opts);
      if(item.active && same(item.nftContract,NFT) && item.tokenId===77n) activeListings.push({id,...item.toObject()});
    }
    const nextStep=fundingStep({listing,activeListings,vault,
      escrowStock:await nft.balanceOf(ESCROW,77n,opts),giftStock:await nft.balanceOf(vault,77n,opts)});
    return { operation:'READ ONLY; wallet approval required', block, vault,
      policy:'Delist 15, transfer 10 directly from sale escrow, relist 890 at unchanged price. Voyager untouched. No activation.',
      nextStep, instruction:nextStep.complete
        ? 'Cutover complete. No further funding transaction. Publish the verified replacement checkout link; activation remains separate.'
        : 'Sign only this next step with TheJollyLama.eth on Base. Wait for confirmation, then rerun. Never resend an unresolved transaction.' };
  } finally { p.destroy(); }
}
if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  const {values}=parseArgs({options:{rpc:{type:'string'}}});
  console.log(JSON.stringify(await prepareRewardFunding(values.rpc),null,2));
}
