let peerConnection;
const config = {
  iceServers: [
    {
      urls: ["stun:stun.l.google.com:19302",
      // "stun:stun.services.mozilla.com" ,
      // 'stun:stun1.l.google.com:19302',
      //   'stun:stun2.l.google.com:19302',
        ]
    }
  ]
};

const socket = io.connect(window.location.origin);
const video = document.querySelector("video");
$(function () {
  $('form').submit(function(e) {
    e.preventDefault(); // prevents page reloading
    socket.emit('chat message', $('#name').val()+ ":"+ $('#m').val());
    $('#m').val('');
    return false;
  });
});
socket.on('chat message', function(msg){
      $('#messages').append($('<li>').text(msg));
      window.scrollTo(0, document.body.scrollHeight);
    });
socket.on("offer", (id, description) => {
  peerConnection = new RTCPeerConnection(config);
  peerConnection
    .setRemoteDescription(description)
    .then(() => peerConnection.createAnswer())
    .then(sdp => peerConnection.setLocalDescription(sdp))
    .then(() => {
      socket.emit("answer", id, peerConnection.localDescription);
    });
  peerConnection.ontrack = event => {
    video.srcObject = event.streams[0];
  };
  peerConnection.onicecandidate = event => {
    if (event.candidate) {
      socket.emit("candidate", id, event.candidate);
    }
  };
});

socket.on("candidate", (id, candidate) => {
  peerConnection
    .addIceCandidate(new RTCIceCandidate(candidate))
    .catch(e => console.error(e));
});

socket.on("connect", id => {
  socket.emit("watcher");
});

socket.on("broadcaster", () => {
  socket.emit("watcher");
});

socket.on("disconnectPeer", id => {
  // const streams= video.srcObject;
  streams.getTracks().forEach(track => track.stop());
  // alert("user disconnected");
  video.srcObject = null;
  
  peerConnection[id].close();
  delete peerConnection[id];
});

window.onunload = window.onbeforeunload = () => {
  socket.close();
};
