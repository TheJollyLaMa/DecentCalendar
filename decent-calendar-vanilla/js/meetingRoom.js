/**
 * meetingRoom.js — PeerJS meeting room for DecentCalendar vanilla
 * Initialises a P2P video call using PeerJS (WebRTC).
 */

let _peer = null;

/**
 * Initialise a PeerJS meeting room.
 * @param {string} roomId - Unique room identifier (used as PeerJS peer ID for host)
 * @param {boolean} isHost - Whether this user is the meeting host
 * @param {HTMLVideoElement} videoEl - Video element to show remote stream
 * @returns {Peer} - The PeerJS peer instance
 */
export function initMeetingRoom(roomId, isHost, videoEl) {
  // Disconnect any existing peer session
  if (_peer) {
    _peer.disconnect();
    _peer = null;
  }

  const peer = new Peer(isHost ? roomId : undefined, {
    host: '0.peerjs.com',
    port: 443,
    secure: true,
  });

  _peer = peer;

  peer.on('open', (id) => {
    console.log(`PeerJS connected as: ${id}`);
  });

  peer.on('error', (err) => {
    console.error('PeerJS error:', err);
  });

  if (isHost) {
    // Host: wait for incoming calls and answer with own stream
    peer.on('call', (call) => {
      navigator.mediaDevices
        .getUserMedia({ video: true, audio: true })
        .then((stream) => {
          call.answer(stream);
          call.on('stream', (remoteStream) => {
            if (videoEl) videoEl.srcObject = remoteStream;
          });
        })
        .catch((err) => console.error('Media access error:', err));
    });
  }

  return peer;
}

/**
 * Join a meeting as a guest — call the host peer ID.
 * @param {string} roomId - Host's room/peer ID to call
 * @param {HTMLVideoElement} videoEl - Video element to show remote stream
 */
export function joinMeeting(roomId, videoEl) {
  if (!_peer) {
    console.warn('No active peer session. Call initMeetingRoom first.');
    return;
  }

  navigator.mediaDevices
    .getUserMedia({ video: true, audio: true })
    .then((stream) => {
      const call = _peer.call(roomId, stream);
      call.on('stream', (remoteStream) => {
        if (videoEl) videoEl.srcObject = remoteStream;
      });
    })
    .catch((err) => console.error('Media access error:', err));
}

/**
 * Disconnect from the meeting room.
 */
export function disconnectMeeting() {
  if (_peer) {
    _peer.disconnect();
    _peer = null;
  }
}
