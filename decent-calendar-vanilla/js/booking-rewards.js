import { bookingId } from './booking-client.js';
import { inviteAddress } from './invitations.js';
import { APPOINTMENT_ABI } from './appointment-client.js';

export const BOOKING_REWARD_VERSION = 'dcal-first-booking-rewards-1';
export const BOOKING_REWARD_ABI = [
  'function VERSION() view returns(string)', 'function LIMIT() view returns(uint256)',
  'function appointments() view returns(address)', 'function nft() view returns(address)', 'function tokenId() view returns(uint256)',
  'function enabled() view returns(bool)', 'function startAppointmentId() view returns(uint256)',
  'function awarded() view returns(uint256)', 'function rewardedAppointment(address) view returns(uint256)',
  'function eligible(uint256) view returns(address)',
];
const ZERO = '0x'+'0'.repeat(40);
export function createBookingRewardReader({config,appointmentsConfig,provider,Contract,hashCode}) {
  const same = (a,b)=>String(a).toLowerCase()===String(b).toLowerCase();
  async function read(id,wallet) {
    if (config?.enabled !== true) return {state:'disabled'};
    id=bookingId(id); wallet=inviteAddress(wallet);
    if (!config.address || !/^0x[0-9a-f]{64}$/i.test(config.runtimeCodeHash || '') ||
        !same(config.registry,appointmentsConfig.address) || !same(config.nft,'0xe63EC9f8228720bAAC2fD528C0A6d06B3Dc5439B') ||
        config.tokenId !== '77') throw new Error('Booking gift configuration is not verified.');
    inviteAddress(config.address);
    if (BigInt(await provider.send('eth_chainId',[])) !== 8453n) throw new Error('Booking gifts require Base.');
    const block=await provider.send('eth_getBlockByNumber',['latest',false]);
    if (!block) throw new Error('Base gift state unavailable.');
    const options={blockTag:block.number};
    const code=await provider.getCode(config.address,block.number);
    if (!same(hashCode(code),config.runtimeCodeHash)) throw new Error('Booking gift bytecode differs from reviewed source.');
    if (!appointmentsConfig.runtimeCodeHash || !same(hashCode(await provider.getCode(config.registry,block.number)),appointmentsConfig.runtimeCodeHash)) {
      throw new Error('Booking gift appointment registry differs from the reviewed deployment.');
    }
    const reward=new Contract(config.address,BOOKING_REWARD_ABI,provider);
    const [version,limit,registry,nft,token,enabled,start,awarded,received,eligible]=await Promise.all([
      reward.VERSION(options),reward.LIMIT(options),reward.appointments(options),reward.nft(options),reward.tokenId(options),
      reward.enabled(options),reward.startAppointmentId(options),reward.awarded(options),
      reward.rewardedAppointment(wallet,options),reward.eligible(id,options),
    ]);
    if (version!==BOOKING_REWARD_VERSION || limit!==10n || !same(registry,config.registry) ||
        !same(nft,config.nft) || token!==77n) throw new Error('Booking gift policy differs from the approved ten-token promotion.');
    const appointment=new Contract(config.registry,APPOINTMENT_ABI,provider);
    const item=await appointment.getAppointment(id,options);
    const [offer]=await appointment.getOffer(item.offerId,options);
    if (!same(offer.invitee,wallet)) return {state:'unrelated'};
    if (received>0n) return {state:'received',appointmentId:String(received),wallet,block:Number(BigInt(block.number))};
    if (id<start || !enabled || awarded>=10n || item.cancelled || eligible===ZERO) return {state:'ineligible',startAppointmentId:String(start)};
    if (!same(eligible,wallet)) throw new Error('Gift recipient does not match the booking guest.');
    return {state:'pending',appointmentId:String(id),wallet};
  }
  return {read};
}
