/* meetingRoom.js — PeerJS video meeting room (vanilla JS port of MeetingRoom.js) */

let peerInstance = null;

/**
 * Initialize a PeerJS meeting room.
 * Fixes the React bug where meetingRoomID was never actually passed to PeerJS.
 *
 * @param {string} roomId - unique room ID (set per event at creation time)
 * @param {boolean} isHost - true if the current user is the calendar owner
 */
function initMeetingRoom(roomId, isHost) {
  const video = document.getElementById('meeting-video');
  const controls = document.getElementById('meeting-controls');

  if (!roomId) {
    controls.innerHTML = '<p style="color:#f00;">Error: no meeting room ID provided.</p>';
    return;
  }

  // Clean up any existing peer
  if (peerInstance) {
    peerInstance.disconnect();
    peerInstance = null;
  }

  peerInstance = new Peer(isHost ? roomId : undefined, {
    host: '0.peerjs.com',
    port: 443,
    secure: true,
  });

  peerInstance.on('open', (id) => {
    console.log(`PeerJS connected as: ${id}`);
  });

  peerInstance.on('error', (err) => {
    console.error('PeerJS error:', err);
    if (err.type === 'unavailable-id') {
      // Room ID already taken — connect as participant instead
      startCall(roomId, video);
    }
  });

  if (isHost) {
    controls.innerHTML = '<p style="color:#0ff;">Waiting for participants to join...</p>';

    // Host answers incoming calls
    peerInstance.on('call', (call) => {
      navigator.mediaDevices
        .getUserMedia({ video: true, audio: true })
        .then((stream) => {
          // Show host's own video
          video.srcObject = stream;
          call.answer(stream);
          call.on('stream', (remoteStream) => {
            video.srcObject = remoteStream;
          });
          call.on('error', (err) => console.error('Call error:', err));
        })
        .catch((err) => {
          console.error('Media access error:', err);
          alert('Could not access camera/microphone.');
        });
    });
  } else {
    // Participant: show a Join button
    controls.innerHTML = '';
    const joinBtn = document.createElement('button');
    joinBtn.textContent = 'Join Meeting';
    joinBtn.style.cssText = 'padding:10px 20px;font-size:1rem;border:2px solid #0ff;border-radius:5px;background:black;color:#0ff;cursor:pointer;';
    joinBtn.addEventListener('click', () => startCall(roomId, video));
    controls.appendChild(joinBtn);

    // Also listen for incoming calls (in case host calls participant first)
    peerInstance.on('call', (call) => {
      navigator.mediaDevices
        .getUserMedia({ video: true, audio: true })
        .then((stream) => {
          call.answer(stream);
          call.on('stream', (remoteStream) => {
            video.srcObject = remoteStream;
          });
        })
        .catch((err) => {
          console.error('Media access error:', err);
          alert('Could not access camera/microphone.');
        });
    });
  }
}

/**
 * Start a call to the host's room.
 * @param {string} roomId
 * @param {HTMLVideoElement} video
 */
function startCall(roomId, video) {
  navigator.mediaDevices
    .getUserMedia({ video: true, audio: true })
    .then((stream) => {
      video.srcObject = stream; // Show local preview while connecting
      const call = peerInstance.call(roomId, stream);
      if (!call) {
        alert('Could not reach the host. Make sure they have the meeting open.');
        return;
      }
      call.on('stream', (remoteStream) => {
        video.srcObject = remoteStream;
      });
      call.on('error', (err) => console.error('Call error:', err));
    })
    .catch((err) => {
      console.error('Media access error:', err);
      alert('Could not access camera/microphone: ' + err.message);
    });
}

/**
 * Close and clean up the meeting room.
 */
function closeMeetingRoom() {
  const video = document.getElementById('meeting-video');
  if (video && video.srcObject) {
    video.srcObject.getTracks().forEach((t) => t.stop());
    video.srcObject = null;
  }
  if (peerInstance) {
    peerInstance.disconnect();
    peerInstance = null;
  }
}
