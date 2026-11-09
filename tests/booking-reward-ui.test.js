import test from 'node:test';
import assert from 'node:assert/strict';
import { installBookingRewards, CELEBRATION_MS } from '../decent-calendar-vanilla/js/booking-reward-ui.js';

function setup(t,{reduced=false,enabled=true}={}) {
  const original={window:globalThis.window,document:globalThis.document,setTimeout:globalThis.setTimeout,clearTimeout:globalThis.clearTimeout};
  t.after(()=>Object.assign(globalThis,original));
  const nodes=[],timers=new Map();let time=0,next=1;
  class Node {
    constructor(tag){this.tag=tag;this.children=[];this.events={};this.attributes={};this.hidden=false;
      this.style={setProperty(){}};this.dataset={};this.classes=new Set();
      this.classList={add:value=>this.classes.add(value),remove:value=>this.classes.delete(value)};
      nodes.push(this);
    }
    append(...values){this.children.push(...values);}
    querySelector(tag){return this.children.find(node=>node.tag===tag);}
    remove(){}
    after(value){this.children.push(value);}
    setAttribute(key,value){this.attributes[key]=value;}
    addEventListener(key,callback){this.events[key]=callback;}
    showModal(){this.open=true;}
    showPopover(){this.popoverOpen=true;}
    hidePopover(){this.popoverOpen=false;}
    close(){this.open=false;this.events.close?.();}
  }
  const body=new Node('body'),summary=new Node('p');
  globalThis.document={body,createElement:tag=>new Node(tag),getElementById:()=>summary,addEventListener(){}};
  globalThis.window={DECENT_CONFIG:{bookingRewards:{enabled,address:'0x'+'11'.repeat(20),nft:'0x'+'22'.repeat(20)}},
    _walletAddress:'0x'+'33'.repeat(20),matchMedia:()=>({matches:reduced,addEventListener(){}}),
    AudioContext:class{constructor(){assert.fail('Celebration must never create audio');}}};
  globalThis.setTimeout=(callback,delay)=>{const id=next++;timers.set(id,{callback,at:time+delay});return id;};
  globalThis.clearTimeout=id=>timers.delete(id);
  const advance=async ms=>{
    time+=ms;
    for(const [id,timer] of [...timers])if(timer.at<=time){timers.delete(id);timer.callback();}
    await new Promise(resolve=>setImmediate(resolve));
  };
  let state='pending';
  const ui=installBookingRewards({
    getReader:()=>({read:async id=>({state,appointmentId:String(id),wallet:window._walletAddress.toLowerCase()})}),
    getArtwork:async()=>({name:'DecentCalendar v0.1.0 Supporter DNFT',image:'https://example.test/supporter.png'}),
  });
  const button=text=>nodes.find(node=>node.tag==='button'&&node.textContent===text);
  return {ui,nodes,advance,button,state:value=>{state=value;}};
}
test('eligible gift runs top lasers and viewport emoji rain for four seconds without sound; delivery remains verified',async t=>{
  const f=setup(t);f.ui.confirmed(1);
  await new Promise(resolve=>setImmediate(resolve));
  const stage=f.nodes.find(node=>node.className==='gift-stage');
  const rain=f.nodes.find(node=>node.className==='gift-rain-overlay');
  const status=f.nodes.find(node=>node.attributes.role==='status');
  assert.equal(CELEBRATION_MS,4000);assert.ok(stage.classes.has('is-celebrating'));
  assert.equal(stage.attributes['aria-hidden'],'true');
  assert.equal(stage.children.length,6);
  assert.ok(stage.children.every(beam=>beam.className==='gift-beam'));
  assert.equal(rain.children.length,24);
  assert.ok(rain.children.every(emoji=>emoji.className==='gift-emoji' && ['📅','✨','🤝','🐇','🎉','💜','⏰','🌍'].includes(emoji.textContent)));
  assert.equal(rain.attributes.popover,'manual');assert.equal(rain.attributes['aria-hidden'],'true');
  assert.equal(rain.attributes.inert,'');assert.equal(rain.popoverOpen,true);
  assert.ok(f.nodes.find(node=>node.tag==='body').children.includes(rain));
  assert.equal(f.nodes.find(node=>node.tag==='dialog').children.includes(rain),false);
  assert.equal(f.button('Celebrate with sound'),undefined);
  assert.equal(f.nodes.some(node=>node.tag==='details'||node.tag==='summary'),false);
  const artwork=f.nodes.find(node=>node.className==='gift-token-art');
  assert.equal(new URL(artwork.href).searchParams.get('tokenId'),'77');
  assert.equal(new URL(artwork.href).pathname,'/DecentMarket/');
  assert.equal(artwork.querySelector('img').src,'https://example.test/supporter.png');
  assert.match(status.textContent,/Delivery pending/);
  await f.advance(3999);assert.ok(stage.classes.has('is-celebrating'));
  await f.advance(1);assert.equal(stage.classes.has('is-celebrating'),false);
  assert.equal(rain.popoverOpen,false);assert.equal(rain.classes.has('is-celebrating'),false);
  f.ui.inspect(1);await new Promise(resolve=>setImmediate(resolve));
  f.button('Skip show').onclick();assert.equal(stage.classes.has('is-celebrating'),false);
  f.state('received');f.ui.confirmed(1);await new Promise(resolve=>setImmediate(resolve));
  assert.match(status.textContent,/Received on Base/);
});
test('reduced motion stays static; close/disconnect stop the show and stale wallet work',async t=>{
  const f=setup(t,{reduced:true});f.ui.confirmed(1);await new Promise(resolve=>setImmediate(resolve));
  const stage=f.nodes.find(node=>node.className==='gift-stage');
  assert.equal(stage.classes.has('is-celebrating'),false);
  assert.equal(f.nodes.find(node=>node.className==='gift-rain-overlay').popoverOpen,false);
  assert.equal(f.button('Skip show').hidden,true);
  f.ui.clear();
  const dialog=f.nodes.find(node=>node.tag==='dialog');
  assert.equal(dialog.open,false);assert.equal(f.button('Your booking gift').hidden,true);
});
test('Continue stops emoji rain immediately',async t=>{
  const f=setup(t);f.ui.confirmed(1);await new Promise(resolve=>setImmediate(resolve));
  const stage=f.nodes.find(node=>node.className==='gift-stage');
  f.button('Continue').onclick();
  assert.equal(stage.classes.has('is-celebrating'),false);
  assert.equal(f.nodes.find(node=>node.className==='gift-rain-overlay').popoverOpen,false);
  assert.equal(f.nodes.find(node=>node.tag==='dialog').open,false);
});
test('disabled promotion adds no advertisement or gift UI',t=>{
  const f=setup(t,{enabled:false});
  assert.equal(f.nodes.some(node=>node.tag==='dialog'),false);
  assert.equal(f.nodes.some(node=>node.tag==='button'),false);
});
