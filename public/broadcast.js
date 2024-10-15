document.addEventListener("DOMContentLoaded", function () {
  let mediaStream = null;
  const peerConnections = {};
  const config = {
      iceServers: [
          {
              urls: ["stun:stun.l.google.com:19302"]
          }
      ]
  };


const socket = io.connect(window.location.origin);
const videoElement = document.querySelector('video');
const audioInputSelect = document.querySelector('select#audioSource');
const audioOutputSelect = document.querySelector('select#audioOutput');
const videoSelect = document.querySelector('select#videoSource');
const startCameraButton = document.querySelector('button#start');
const recordButton = document.querySelector('button#record');
const selectors = [audioInputSelect, audioOutputSelect, videoSelect];

if (!startCameraButton) {
  console.error('Camera toggle button not found in DOM');
  return;
}

// Disable audio output select if not supported
audioOutputSelect.disabled = !('sinkId' in HTMLMediaElement.prototype);

// Event listener for the "Start Camera" button
startCameraButton.addEventListener('click', () => {
  // Start-Stop the camera stream when the button is clicked
  if (mediaStream) {
    stopCamera();
  } else {
      navigator.mediaDevices.enumerateDevices()
          .then(gotDevices)
          .then(start)
          .catch(handleError);
  }
});

// Debounced stream start
let startTimeout;
audioInputSelect.onchange = () => debounceStart();
videoSelect.onchange = () => debounceStart();

function debounceStart() {
  if (startTimeout) clearTimeout(startTimeout);
  startTimeout = setTimeout(() => start(), 500);  // 500ms debounce
}

function gotDevices(deviceInfos) {
  const values = selectors.map(select => select.value);
  selectors.forEach(select => {
    while (select.firstChild) {
      select.removeChild(select.firstChild);
    }
  });
  for (let i = 0; i !== deviceInfos.length; ++i) {
    const deviceInfo = deviceInfos[i];
    const option = document.createElement('option');
    option.value = deviceInfo.deviceId;
    if (deviceInfo.kind === 'audioinput') {
      option.text = deviceInfo.label || `microphone ${audioInputSelect.length + 1}`;
      audioInputSelect.appendChild(option);
    } else if (deviceInfo.kind === 'audiooutput') {
      option.text = deviceInfo.label || `speaker ${audioOutputSelect.length + 1}`;
      audioOutputSelect.appendChild(option);
    } else if (deviceInfo.kind === 'videoinput') {
      option.text = deviceInfo.label || `camera ${videoSelect.length + 1}`;
      videoSelect.appendChild(option);
    }
  }
  selectors.forEach((select, selectorIndex) => {
    if (Array.prototype.slice.call(select.childNodes).some(n => n.value === values[selectorIndex])) {
      select.value = values[selectorIndex];
    }
  });
}

function handleError(error) {
  console.error('Error: ', error);
  alert(`Error accessing media devices: ${error.name}. Please check your device.`);
}


async function start() {
  if (mediaStream) {
    mediaStream.getTracks().forEach(track => track.stop());
  }

  const audioSource = audioInputSelect.value;
  const videoSource = videoSelect.value;
  const constraints = {
    audio: {
        echoCancellation: true,
        deviceId: audioSource ? { exact: audioSource } : undefined
    },
    video: {
        deviceId: videoSource ? { exact: videoSource } : undefined
    }
  };
  try {
      mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      gotStream(mediaStream);
      socket.emit("broadcaster");

      // Change button text to "Stop Camera"
      startCameraButton.textContent = "Stop Camera";
  } catch (error) {
      handleError(error);
  }
}

function gotStream(stream) {
  window.stream = stream;
  videoElement.srcObject = stream;
  // Enable the "Start Recording" button once the stream is active
  document.querySelector('button#record').disabled = false;
  
  // Disable the "Download" button initially (enabled only after recording or snapshot)
  document.querySelector('button#download').disabled = true;
  return navigator.mediaDevices.enumerateDevices();
}

// Function to stop the camera (media stream)
function stopCamera() {
  if (mediaStream) {
      mediaStream.getTracks().forEach(track => track.stop());
      videoElement.srcObject = null;

      // Change button text back to "Start Camera"
      startCameraButton.textContent = "Start Camera";
      console.log('Camera stopped.');
      mediaStream = null;
  }
}

// Bandwidth SDP modification
function setBandwidth(sdp, bandwidth) {
  return sdp.replace(/b=AS:\d+/g, 'b=AS:' + bandwidth);
}

// WebRTC Setup
socket.on("watcher", id => {
  const peerConnection = new RTCPeerConnection(config);
  peerConnections[id] = peerConnection;
  
  // Add broadcaster's stream to peer connection
  let stream = videoElement.srcObject;
  stream.getTracks().forEach(track => peerConnection.addTrack(track, stream));

  peerConnection.onicecandidate = event => {
    if (event.candidate) {
      socket.emit("candidate", id, event.candidate);
    }
  };

  peerConnection.createOffer()
  .then(sdp => {
    sdp.sdp = setBandwidth(sdp.sdp, 512);  // Set bandwidth to 512 kbps
    return peerConnection.setLocalDescription(sdp);
  })
  .then(() => {
    socket.emit("offer", id, peerConnection.localDescription);
  });

  peerConnection.onconnectionstatechange = () => {
    if (peerConnection.connectionState === 'connected') {
      console.log('Peer connected:', id);
    }
  };
});

// Handling ICE candidates from the peer
socket.on("candidate", (id, candidate) => {
  peerConnections[id].addIceCandidate(new RTCIceCandidate(candidate)).catch(e => console.error(e));
});

// Handling answers from watchers
socket.on("answer", (id, description) => {
  peerConnections[id].setRemoteDescription(description);
});

// Handle watcher disconnection
socket.on("disconnectPeer", id => {
  if (peerConnections[id]) {
    peerConnections[id].close();
    delete peerConnections[id];
    console.log(`Peer ${id} disconnected.`);
  }
});

window.onunload = window.onbeforeunload = () => {
  socket.close();
};

// Record Video Functionality
let mediaRecorder;
let recordedBlobs = [];

// Initially set the button text to "Start Recording"
recordButton.textContent = "Start Recording";

// Add event listener to the record button
recordButton.addEventListener('click', () => {
  if (mediaRecorder && mediaRecorder.state === "recording") {
    stopRecording();
  } else {
    startRecording();
  }
});

function startRecording() {
  recordedBlobs = [];
  let options = { mimeType: 'video/webm;codecs=vp9' };
  try {
    mediaRecorder = new MediaRecorder(window.stream, options);
  } catch (e) {
    console.error('MediaRecorder error:', e);
    alert('MediaRecorder not supported by your browser.');
    return;
  }

  // Update the button text to "Stop Recording"
  recordButton.textContent = "Stop Recording";

  mediaRecorder.onstop = () => {
    const blob = new Blob(recordedBlobs, { type: 'video/webm' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = 'recording.webm';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    // Enable the "Download" button after recording stops
    document.querySelector('button#download').disabled = false;
    
    // Revert the record button text to "Start Recording"
    recordButton.textContent = "Start Recording";
  };

  mediaRecorder.ondataavailable = (event) => {
    if (event.data && event.data.size > 0) {
      recordedBlobs.push(event.data);
    }
  };

  mediaRecorder.start();
  console.log('Recording started...');
}

function stopRecording() {
  mediaRecorder.stop();
  console.log('Recording stopped.');

  // Change the button text back to "Start Recording"
  recordButton.textContent = "Start Recording";
}

// Take Picture from Video Stream
document.querySelector('button#photo').addEventListener('click', takePicture);

function takePicture() {
  const canvas = document.getElementById('canvas');
  const context = canvas.getContext('2d');
  context.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL('image/png');
  
  // Set photo URL for download and enable the "Download" button
  const downloadButton = document.querySelector('button#download');
  downloadButton.href = dataUrl;
  downloadButton.download = 'snapshot.png';
  downloadButton.disabled = false;
}
});