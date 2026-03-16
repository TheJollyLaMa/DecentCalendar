import React, { useEffect, useRef } from "react";
import Peer from "peerjs";

const MeetingRoom = ({ roomId, isHost }) => {
  const videoRef = useRef(null);
  const peerRef = useRef(null); // Use useRef to persist the Peer instance

  useEffect(() => {
    peerRef.current = new Peer(roomId, {
      host: "0.peerjs.com",
      port: 443,
      secure: true,
    });

    peerRef.current.on("open", (id) => {
      console.log(`Connected as: ${id}`);
    });

    if (!isHost) {
      peerRef.current.on("call", (call) => {
        navigator.mediaDevices
          .getUserMedia({ video: true, audio: true })
          .then((stream) => {
            call.answer(stream); // Answer the call with the local video stream
            call.on("stream", (remoteStream) => {
              videoRef.current.srcObject = remoteStream; // Show the remote stream
            });
          });
      });
    }

    return () => peerRef.current.disconnect(); // Clean up on component unmount
  }, [roomId, isHost]);

  const startCall = () => {
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((stream) => {
        const call = peerRef.current.call(roomId, stream); // Initiate a call to the host
        call.on("stream", (remoteStream) => {
          videoRef.current.srcObject = remoteStream; // Show the remote stream
        });
      });
  };

  return (
    <div>
      <video ref={videoRef} autoPlay playsInline style={{ width: "100%" }} />
      {isHost ? (
        <p>Waiting for participants...</p>
      ) : (
        <button onClick={startCall}>Join Meeting</button>
      )}
    </div>
  );
};

export default MeetingRoom;