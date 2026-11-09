import test from 'node:test';
import assert from 'node:assert/strict';
import { loadSupporterArt, supporterMarketLink, supporterAssetURL } from '../decent-calendar-vanilla/js/supporter-art.js';
import { SUPPORTER_RELEASE } from '../decent-calendar-vanilla/js/supporter-release.js';

test('square token artwork comes from verified release metadata, not an invented image',async()=>{
  let requested;
  const art=await loadSupporterArt({fetcher:async(url,options)=>{
    requested=url;assert.ok(options.signal);assert.equal(options.referrerPolicy,'no-referrer');
    return {ok:true,text:async()=>JSON.stringify({name:'DCal Supporter',image:'ipfs://QmArtwork'})};
  }});
  assert.equal(requested,'https://gateway.pinata.cloud/ipfs/QmPqCy2g53t4BaffprtfjfM4L5imACB1nWZK63HyN9o3Tj');
  assert.deepEqual(art,{name:'DCal Supporter',image:'https://gateway.pinata.cloud/ipfs/QmArtwork'});
});
test('Market deep link selects the exact canonical token and does not initiate purchase',()=>{
  const url=new URL(supporterMarketLink());
  assert.equal(url.origin,'https://thejollylama.github.io');assert.equal(url.pathname,'/DecentMarket/');
  assert.equal(url.searchParams.get('supporters'),'1');assert.equal(url.searchParams.get('chainId'),'8453');
  assert.equal(url.searchParams.get('nftContract'),SUPPORTER_RELEASE.nftContract);
  assert.equal(url.searchParams.get('tokenId'),'77');
  assert.equal(url.searchParams.has('listingId'),false);
  assert.throws(()=>supporterMarketLink({...SUPPORTER_RELEASE,chainId:1}));
  assert.throws(()=>supporterMarketLink({...SUPPORTER_RELEASE,tokenId:'1e2'}));
});
test('failed or unsafe metadata/artwork remains an explicit error',async()=>{
  for(const uri of ['javascript:alert(1)','data:image/svg+xml,test','https://user:pass@example.test/image',''])assert.throws(()=>supporterAssetURL(uri));
  await assert.rejects(loadSupporterArt({fetcher:async()=>({ok:false,status:503})}),/HTTP 503/);
  for(const value of ['[]','{}','bad json',JSON.stringify({name:'DCal',image:'javascript:alert(1)'}),'x'.repeat(65537)]){
    await assert.rejects(loadSupporterArt({fetcher:async()=>({ok:true,text:async()=>value})}));
  }
});
