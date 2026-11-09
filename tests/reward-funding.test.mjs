import test from 'node:test';
import assert from 'node:assert/strict';
import { fundingStep, NFT, ESCROW, OWNER } from '../scripts/prepare-reward-funding.mjs';
const vault='0xB079B367efA71Aa4C9358d4A46d72Dfd0AF4bc44';
const listing={nftContract:NFT,tokenId:77n,priceETH:0n,priceToken:'0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',priceAmount:10000000n,available:900n,active:true,note:'DCal'};
test('sale cutover offers only the verified next step and never touches Voyager',()=>{
  const state={listing,escrowStock:900n,giftStock:0n,activeListings:[{id:15n,...listing}],vault};
  const first=fundingStep(state);assert.equal(first.method,'delistDNFT');assert.equal(first.to,ESCROW);assert.equal(first.from,OWNER);
  const second=fundingStep({...state,listing:{...listing,active:false},activeListings:[]});
  assert.equal(second.method,'withdrawNFT');assert.deepEqual(second.args,[NFT,'77','10',vault]);
  const final={...state,listing:{...listing,active:false},escrowStock:890n,giftStock:10n,activeListings:[]};
  assert.deepEqual(fundingStep(final).args,[NFT,'77','0',listing.priceToken,'10000000','890','DCal']);
  assert.deepEqual(fundingStep({...final,activeListings:[{id:20n,...listing,available:890n}]}),{complete:true,listingId:'20'});
});
test('changed stock, live gifts, duplicate listings or price changes block signatures',()=>{
  const state={listing,escrowStock:900n,giftStock:0n,activeListings:[{id:15n,...listing}],vault};
  for(const patch of [{escrowStock:899n},{giftStock:10n},{activeListings:[]},{listing:{...listing,priceAmount:1n}},{listing:{...listing,active:false},escrowStock:880n}])
    assert.throws(()=>fundingStep({...state,...patch}));
});
