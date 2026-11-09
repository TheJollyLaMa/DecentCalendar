import { JsonRpcProvider, Wallet, Transaction, keccak256 } from 'ethers';
import { readFile, writeFile, rename } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { prepareRewardFunding, OWNER } from './prepare-reward-funding.mjs';

const { values }=parseArgs({options:{execute:{type:'boolean',default:false}}});
if(!values.execute) throw new Error('Explicit --execute required; use prepare:reward-funding for read-only review.');
if(!/^0x[0-9a-fA-F]{64}$/.test(process.env.JOLLY_PRIVATE_KEY || '')) throw new Error('Local JOLLY_PRIVATE_KEY is missing or malformed.');
const provider=new JsonRpcProvider('https://mainnet.base.org',8453,{staticNetwork:true});
const wallet=new Wallet(process.env.JOLLY_PRIVATE_KEY,provider);
if(wallet.address.toLowerCase()!==OWNER.toLowerCase()) throw new Error('Key is not the Market owner.');
const path=new URL('../.reward-funding-journal.json',import.meta.url);
const limit=150000000000000n, perSend=50000000000000n, l1Reserve=10000000000000n;
let journal={policy:'dcal-77-sale-to-gifts-10',transactions:[]};
try { journal=JSON.parse(await readFile(path,'utf8')); }
catch(error){if(error.code!=='ENOENT')throw error;}
if(journal.policy!=='dcal-77-sale-to-gifts-10'||!Array.isArray(journal.transactions))throw new Error('Funding journal policy mismatch.');
async function persist(){
  const pending=new URL('../.reward-funding-journal.tmp',import.meta.url);
  await writeFile(pending,JSON.stringify(journal,null,2)+'\n',{mode:0o600});
  await rename(pending,path);
}
try {
  if(BigInt(await provider.send('eth_chainId',[]))!==8453n)throw new Error('Wrong chain.');
  for(let iteration=0;iteration<4;iteration++){
    const pending=journal.transactions.find(x=>!x.receipt);
    if(pending){
      const tx=Transaction.from(pending.raw);
      if(tx.hash!==pending.hash || tx.from?.toLowerCase()!==OWNER.toLowerCase() ||
          tx.to?.toLowerCase()!=='0x31b07b83e99a9bdf379bf40225b8a80d3804c89d' ||
          tx.chainId!==8453n || tx.value!==0n || tx.data!==pending.data ||
          tx.gasLimit*(tx.maxFeePerGas || 0n)+l1Reserve>perSend)
        throw new Error('Pending journal transaction mismatch.');
      let receipt=await provider.getTransactionReceipt(pending.hash);
      if(!receipt){
        if(!await provider.getTransaction(pending.hash)) {
          try { await provider.broadcastTransaction(pending.raw); }
          catch(error){
            if(error.error?.message!=='already known' && error.code!=='NONCE_EXPIRED')throw error;
            console.log(`${pending.method}: RPC reports known/used nonce; verifying this exact hash before proceeding.`);
          }
        }
      }
      receipt=await provider.waitForTransaction(pending.hash,2,180000);
      if(!receipt)throw new Error('Pending transaction unresolved; rerun to reconcile, never replace.');
      if(receipt.status!==1)throw new Error('Funding transaction reverted; stop and review.');
      const rawReceipt=await provider.send('eth_getTransactionReceipt',[pending.hash]);
      if(rawReceipt.l1Fee===undefined)throw new Error('Base L1 fee unavailable; stop before further spending.');
      pending.receipt={block:receipt.blockNumber,fee:String(receipt.fee+BigInt(rawReceipt.l1Fee))};
      await persist();
      console.log(`${pending.method} confirmed: ${pending.hash}`);
      if(BigInt(pending.receipt.fee)>BigInt(pending.reserved))throw new Error('Actual fee exceeded reserve; stop and review.');
    }
    const plan=await prepareRewardFunding();
    if(plan.nextStep.complete){
      journal.complete=plan.nextStep;journal.verifiedBlock=plan.block;await persist();
      console.log(JSON.stringify({complete:plan.nextStep,verifiedBlock:plan.block,transactions:journal.transactions.map(({method,hash,receipt})=>({method,hash,receipt}))},null,2));break;
    }
    const step=plan.nextStep;
    if(journal.transactions.some(x=>x.method===step.method))throw new Error('Confirmed step has not changed live state; stop and reconcile.');
    const fee=await provider.getFeeData();
    if(fee.maxFeePerGas===null || fee.maxPriorityFeePerGas===null)throw new Error('Base fee quote unavailable.');
    const request={to:step.to,data:step.data,value:0n,from:OWNER};
    await provider.call(request);
    const gasLimit=(await provider.estimateGas(request))*120n/100n;
    const reserved=gasLimit*fee.maxFeePerGas+l1Reserve;
    const spent=journal.transactions.reduce((sum,x)=>sum+BigInt(x.receipt?.fee||x.reserved),0n);
    if(reserved>perSend || spent+reserved>limit)throw new Error('Cutover exceeds approved setup fee reserve.');
    if(await provider.getBalance(OWNER)<reserved)throw new Error('Owner lacks gas for capped transaction.');
    const raw=await wallet.signTransaction({...request,chainId:8453,type:2,nonce:await provider.getTransactionCount(OWNER,'pending'),
      gasLimit,maxFeePerGas:fee.maxFeePerGas,maxPriorityFeePerGas:fee.maxPriorityFeePerGas});
    journal.transactions.push({method:step.method,data:step.data,raw,hash:keccak256(raw),reserved:String(reserved)});
    await persist();
    // Only journaled bytes are broadcast, including on restart.
    const saved=journal.transactions.at(-1);
    await provider.broadcastTransaction(saved.raw);
    console.log(`${saved.method} submitted: ${saved.hash}`);
  }
} finally {provider.destroy();}
