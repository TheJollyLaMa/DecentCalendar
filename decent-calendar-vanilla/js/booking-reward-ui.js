import { createBookingRewardReader } from './booking-rewards.js';
import { loadSupporterArt, supporterMarketLink } from './supporter-art.js';

export const CELEBRATION_MS = 4000;
export function installBookingRewards({getReader,getArtwork=loadSupporterArt}={}) {
  const config=window.DECENT_CONFIG.bookingRewards;
  if (config?.enabled !== true) return {clear() {}};
  const dialog=document.createElement('dialog');
  dialog.className='booking-gift';
  dialog.setAttribute('aria-labelledby','booking-gift-title');
  const node=(tag,text)=>{const value=document.createElement(tag);if(text!==undefined)value.textContent=text;return value;};
  const stage=node('div');stage.className='gift-stage';stage.setAttribute('aria-hidden','true');
  for(let i=0;i<6;i++){
    const beam=node('span');beam.className='gift-beam';
    beam.style.setProperty('--angle',`${(i-2.5)*22}deg`);
    beam.style.setProperty('--delay',`${i*0.12}s`);
    stage.append(beam);
  }
  const rain=node('div');rain.className='gift-rain-overlay';
  rain.setAttribute('popover','manual');rain.setAttribute('aria-hidden','true');rain.setAttribute('inert','');
  const emojis=['📅','✨','🤝','🐇','🎉','💜','⏰','🌍'];
  for(let i=0;i<24;i++){
    const emoji=node('span',emojis[i%emojis.length]);emoji.className='gift-emoji';
    emoji.style.setProperty('--left',`${(i*37)%96}%`);
    emoji.style.setProperty('--delay',`${(i%8)*0.15}s`);
    emoji.style.setProperty('--tilt',`${i%2===0?-24:24}deg`);
    rain.append(emoji);
  }
  const heading=node('h2','A little Decent surprise');heading.id='booking-gift-title';
  const subtitle=node('p','Your first booking is worth celebrating.');
  const status=node('p');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  const card=node('div');card.className='gift-token-card';
  const artwork=node('a');artwork.className='gift-token-art';
  artwork.href=supporterMarketLink();artwork.target='_blank';artwork.rel='noopener noreferrer';
  artwork.setAttribute('aria-label','View DecentCalendar Supporter #77 and purchase options in DecentMarket');
  const artStatus=node('span','Loading token artwork…');artStatus.setAttribute('role','status');
  artwork.append(artStatus);
  const artRetry=node('button','Retry artwork');artRetry.type='button';artRetry.hidden=true;
  let artLoading=false;
  async function renderArtwork() {
    if(artLoading)return;
    artLoading=true;artRetry.hidden=true;artStatus.textContent='Loading token artwork…';
    try {
      const art=await getArtwork();
      const image=node('img');image.alt=art.name;image.referrerPolicy='no-referrer';image.decoding='async';
      image.onload=()=>{artStatus.hidden=true;artLoading=false;};
      image.onerror=()=>{
        console.error('[DCal supporter artwork] Image could not be loaded:',art.image);
        image.remove();artStatus.hidden=false;artStatus.textContent='Artwork unavailable. Open in DecentMarket.';artRetry.hidden=false;artLoading=false;
      };
      image.src=art.image;
      artwork.querySelector('img')?.remove();
      artwork.append(image);
    } catch(error){
      console.error('[DCal supporter artwork]',error);
      artStatus.hidden=false;artStatus.textContent='Artwork unavailable. Open in DecentMarket.';artRetry.hidden=false;artLoading=false;
    }
  }
  artRetry.onclick=()=>{void renderArtwork();};
  card.append(artwork,artRetry,node('strong','DecentCalendar Supporter'),node('p','v0.1.0 · Base token #77'),
    node('p','A dated piece of our build. Thanks for making time together.'));
  const receipt=node('a','View your token');receipt.target='_blank';receipt.rel='noopener noreferrer';receipt.hidden=true;
  receipt.href=`https://basescan.org/token/${config.nft}?a=77`;
  const promotion=node('a','Explore DecentCalendar Supporter');
  promotion.href=supporterMarketLink();
  promotion.target='_blank';promotion.rel='noopener noreferrer';
  const controls=node('div');controls.className='gift-controls';
  const skip=node('button','Skip show');skip.type='button';
  const close=node('button','Continue');close.type='button';
  controls.append(skip,close);
  dialog.append(stage,heading,subtitle,status,card,receipt,promotion,controls);
  document.body.append(dialog,rain);
  void renderArtwork();
  const reopen=node('button','Your booking gift');reopen.type='button';reopen.hidden=true;
  document.getElementById('appointment-summary').after(reopen);
  let reader, generation=0, readSequence=0, current, pollTimer, showTimer, startTime, promotionStart=0n, seen=new Set();
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  const wallet=()=>window._walletAddress?.toLowerCase();
  function stopShow() {
    clearTimeout(showTimer);stage.classList.remove('is-celebrating');skip.hidden=true;
    rain.classList.remove('is-celebrating');rain.hidePopover();
  }
  function show() {
    stopShow();
    if(!reduced.matches){
      stage.classList.add('is-celebrating');rain.showPopover();rain.classList.add('is-celebrating');
      skip.hidden=false;showTimer=setTimeout(stopShow,CELEBRATION_MS);
    }
  }
  async function api() {
    if(getReader)return getReader();
    if(!reader){
      const {loadEthers}=await import('../vendor/decent-head/2.0.0/js/wallet.js');
      const {Contract,JsonRpcProvider,FetchRequest,keccak256}=await loadEthers();
      const request=new FetchRequest(window.DECENT_CONFIG.chain.rpcUrls[0]);request.timeout=12000;
      reader=createBookingRewardReader({config,appointmentsConfig:window.DECENT_CONFIG.appointments,
        provider:new JsonRpcProvider(request,8453,{staticNetwork:true}),Contract,hashCode:keccak256});
    }
    return reader;
  }
  const render=value=>{
    receipt.hidden=value.state!=='received';
    heading.textContent=value.state==='received'?'A Decent gift, delivered':'A little Decent surprise';
    status.textContent=value.state==='received'
      ? 'Received on Base. One DecentCalendar Supporter is now yours.'
      : 'Delivery pending. Our worker will transfer your gift; no extra wallet signature is needed.';
    reopen.hidden=false;
  };
  function clear() {
    generation++;current=null;clearTimeout(pollTimer);stopShow();reopen.hidden=true;
    if(dialog.open)dialog.close();
  }
  async function check(id,{force=false}={}) {
    const address=wallet(),request=generation,sequence=++readSequence;
    if(!address)return;
    try {
      const value=await (await api()).read(id,address);
      if(request!==generation || sequence!==readSequence || address!==wallet())return;
      if(!['pending','received'].includes(value.state)){
        if(value.startAppointmentId)promotionStart=BigInt(value.startAppointmentId);
        if(current?.appointmentId===String(id)){
          clearTimeout(pollTimer);status.textContent='Gift no longer eligible or promotion paused. Your booking is unchanged.';stopShow();
        }
        return value;
      }
      current=value;render(value);
      const key=`${config.address}:${address}`;
      if(force || !seen.has(key)){
        seen.add(key);startTime=Date.now();
        if(!dialog.open)dialog.showModal();
        show();
      }
      clearTimeout(pollTimer);
      if(value.state==='pending' && dialog.open){
        if(Date.now()-startTime>90000)status.textContent='Delivery still pending. The worker may be paused or offline; your booking is confirmed. Check again later or contact the steward.';
        pollTimer=setTimeout(()=>{void check(id);},10000);
      }
      return value;
    } catch(error){
      console.error('[DCal booking gift]',error);
      if(request===generation && sequence===readSequence && address===wallet() && current){
        status.textContent=`Could not verify gift delivery: ${error.shortMessage || error.message}. Your booking is unchanged.`;
        clearTimeout(pollTimer);stopShow();
      }
    }
  }
  skip.onclick=stopShow;close.onclick=()=>dialog.close();
  dialog.addEventListener('close',()=>{stopShow();clearTimeout(pollTimer);});
  dialog.addEventListener('cancel',stopShow);
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){stopShow();clearTimeout(pollTimer);}
    else if(current && dialog.open)void check(current.appointmentId);
  });
  reopen.onclick=()=>{if(current)void check(current.appointmentId,{force:true});};
  reduced.addEventListener('change',()=>{if(reduced.matches)stopShow();});
  const controller={
    clear,
    confirmed:id=>{void check(id);},
    inspect:id=>{void check(id,{force:true});},
    recover:state=>{
      if(current && current.wallet===wallet())return;
      const candidates=state.appointments.filter(item=>!item.cancelled && item.id>=promotionStart && item.invitee.toLowerCase()===wallet())
        .sort((a,b)=>a.id<b.id?-1:1);
      if(candidates.length)void (async()=>{
        const first=await check(candidates[0].id);
        if(first?.state==='ineligible' && candidates[0].id<promotionStart){
          const next=candidates.find(item=>item.id>=promotionStart);
          if(next)await check(next.id);
        }
      })();
    },
  };
  window.DCalBookingRewards=controller;
  return controller;
}
