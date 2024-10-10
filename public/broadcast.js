
const peerConnections = {};
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
const videoElement = document.querySelector('video');
const audioInputSelect = document.querySelector('select#audioSource');
const audioOutputSelect = document.querySelector('select#audioOutput');
const videoSelect = document.querySelector('select#videoSource');
const selectors = [audioInputSelect, audioOutputSelect, videoSelect];

audioOutputSelect.disabled = !('sinkId' in HTMLMediaElement.prototype);
socket.on('chat message', function(msg){
      $('#messages').append($('<li>').text(msg));
      window.scrollTo(0, document.body.scrollHeight);
    });

    navigator.mediaDevices
  .enumerateDevices()
  .then(gotDevices)
  .then(getStream)
  .catch(handleError);

audioInputSelect.onchange = getStream;
videoSelect.onchange = getStream;

function gotDevices(deviceInfos) {
  // Handles being called several times to update labels. Preserve values.
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
    } else {
      console.log('Some other kind of source/device: ', deviceInfo);
    }
  }
  selectors.forEach((select, selectorIndex) => {
    if (Array.prototype.slice.call(select.childNodes).some(n => n.value === values[selectorIndex])) {
      select.value = values[selectorIndex];
    }
  });
}

function getStream() {
  if (stream) {
    stream.getTracks().forEach(function (track) {
      track.stop();
    });
  }
}

navigator.mediaDevices.enumerateDevices().then(gotDevices).catch(handleError);

// Attach audio output device to video element using device/sink ID.
function attachSinkId(element, sinkId) {
  if (typeof element.sinkId !== 'undefined') {
    element.setSinkId(sinkId)
        .then(() => {
          console.log(`Success, audio output device attached: ${sinkId}`);
        })
        .catch(error => {
          let errorMessage = error;
          if (error.name === 'SecurityError') {
            errorMessage = `You need to use HTTPS for selecting audio output device: ${error}`;
          }
          console.error(errorMessage);
          // Jump back to first output device in the list as it's the default.
          audioOutputSelect.selectedIndex = 0;
        });
  } else {
    console.warn('Browser does not support output device selection.');
  }
}

function changeAudioDestination() {
  const audioDestination = audioOutputSelect.value;
  attachSinkId(videoElement, audioDestination);
}

function gotStream(stream) {
   window.stream = stream;
  videoElement.srcObject = stream;

  // Refresh button list in case labels have become available
  return navigator.mediaDevices.enumerateDevices();
}

function handleError(error) {
  console.log('navigator.MediaDevices.getUserMedia error: ', error.message, error.name);
}

async function start() {
  if (window.stream) {
    window.stream.getTracks().forEach(track => {
      track.stop();
    });
  }
  const audioSource = audioInputSelect.value;
  const videoSource = videoSelect.value;
  const constraints = {
    audio: {
      echoCancellation: true,
      deviceId: audioSource ? {exact: audioSource} : undefined
    },
    video: {
      
      deviceId: videoSource ? {exact: videoSource} : undefined
    }
  };

  await navigator.mediaDevices.getUserMedia(constraints).then(gotStream).then(gotDevices).then(() =>{socket.emit("broadcaster");}).catch(handleError);


}

audioInputSelect.onchange = start;
audioOutputSelect.onchange = changeAudioDestination;

videoSelect.onchange = start;

// Media contrains
// const constraints = {
//   video: {
//     width: {
//         min: 1280,
//         ideal: 1920,
//         max: 2560,
//       },
//       height: {
//          min: 720,
//          ideal: 1080,
//          max: 1440
//        },
//      facingMode: 'user',
//   },
//   // Uncomment to enable audio
//     audio: {
//       sampleRate: 48000,
//         channelCount: 1,
//         volume: 1.0,
//       echoCancellation: true
//     },
// };
//
// navigator.mediaDevices
//   .getUserMedia(constraints)
//   .then(stream => {
//     video.srcObject = stream;
//     socket.emit("broadcaster");
//   })
//   .catch(error => console.error(error));
  socket.on("watcher", id => {
  const peerConnection = new RTCPeerConnection(config);
  peerConnection.bandwidth={
    audio:50,
    video:256,
    screen:300
  };
  peerConnections[id] = peerConnection;

  let stream = videoElement.srcObject;
  stream.getTracks().forEach(track => peerConnection.addTrack(track, stream));

  peerConnection.onicecandidate = event => {
    if (event.candidate) {
      socket.emit("candidate", id, event.candidate);
    }
  };

  peerConnection
    .createOffer()
    .then(sdp => peerConnection.setLocalDescription(sdp))
    .then(() => {
      socket.emit("offer", id, peerConnection.localDescription);
    });
});

socket.on("answer", (id, description) => {
  peerConnections[id].setRemoteDescription(description);
});

socket.on("candidate", (id, candidate) => {
  peerConnections[id].addIceCandidate(new RTCIceCandidate(candidate));
});

socket.on("disconnectPeer", id => {
  
   stream.getTracks().forEach(track => track.stop());
   videoElement.srcObject = null;
  alert("user disconnected");
  peerConnections[id].close();
  delete peerConnections[id];
});

window.onunload = window.onbeforeunload = () => {
  socket.close();
};

let mediaRecorder;
let recordedBlobs;

const errorMsgElement = document.querySelector('span#errorMsg');
const recordedVideo = document.querySelector('video#recorded');
const recordButton = document.querySelector('button#record');
const takephoto = document.querySelector('button#photo');
const downloadButton = document.querySelector('button#download');
recordButton.addEventListener('click', () => {
//   let streams = videoElement.srcObject;
//   let recorder = RecordRTC(streams, {
//     type: 'video',
//     mimeType: 'video/webm',
//     recorderType: MediaStreamRecorder,
//     bitsPerSecond: 128000,
// });
  if (recordButton.textContent === 'Start Recording') {
    startRecording();
  // recorder.startRecording();
  recordButton.textContent = 'Stop Recording';
  } else {
    stopRecording();
    // recordButton.textContent = 'Start Recording';
    // recorder.stopRecording(function() {
    //   let blob = recorder.getBlob();
    //   invokeSaveAsDialog(blob);
    // playButton.disabled = false;
    downloadButton.disabled = false;
  // });
}
});

// const playButton = document.querySelector('button#play');
// playButton.addEventListener('click', () => {
//   const superBuffer = new Blob(recordedBlobs, {type: 'video/webm'});
//   recordedVideo.src = null;
//   recordedVideo.srcObject = null;
//   recordedVideo.src = window.URL.createObjectURL(superBuffer);
//   recordedVideo.controls = true;
//   recordedVideo.play();
// });


downloadButton.addEventListener('click', () => {
  const blob = new Blob(recordedBlobs, {type: 'video/webm'});
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = 'test.webm';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }, 100);
  
});



async function startRecording() {
  recordedBlobs = [];
  let options = {mimeType: 'video/webm;codecs=vp9,opus'};
  if (!MediaRecorder.isTypeSupported(options.mimeType)) {
    console.error(`${options.mimeType} is not supported`);
    options = {mimeType: 'video/webm;codecs=vp8,opus'};
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      console.error(`${options.mimeType} is not supported`);
      options = {mimeType: 'video/webm'};
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        console.error(`${options.mimeType} is not supported`);
        options = {mimeType: ''};
      }
    }
  }

  try {
    let streams = videoElement.srcObject;
    mediaRecorder = new MediaRecorder(streams, options);
  } catch (e) {
    console.error('Exception while creating MediaRecorder:', e);
    errorMsgElement.innerHTML = `Exception while creating MediaRecorder: ${JSON.stringify(e)}`;
    return;
  }

  console.log('Created MediaRecorder', mediaRecorder, 'with options', options);
  recordButton.textContent = 'Stop Recording';
  // playButton.disabled = true;
  downloadButton.disabled = true;
  mediaRecorder.onstop = (event) => {
    
    console.log('Recorder stopped: ', event);
    console.log('Recorded Blobs: ', recordedBlobs);
    downloadButton.disabled=false;
  };
  mediaRecorder.ondataavailable = handleDataAvailable;
  mediaRecorder.start();
  console.log('MediaRecorder started', mediaRecorder);
  

 

}

function stopRecording() {
  // postVideoToServer();
  
  const blob = new Blob(recordedBlobs, {type: 'video/webm'});
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = 'test.webm';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }, 100);
  mediaRecorder.stop();
}

function postVideoToServer() {
  /*  var x = new XMLHttpRequest();
      x.open('POST', 'uploadMessage');
      x.send(videoblob);
  */
      // var data = {};
      // data.video = videoblob;
      // data.metadata = 'test metadata';
      // data.action = "upload_video";

      // jQuery.post("http://www.foundthru.co.uk/uploadvideo.php", data, onUploadSuccess);

  const blob = new Blob(recordedBlobs, {type: 'video/webm'});
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = 'test.webm';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }, 100);
  }

function handleDataAvailable(event) {
  console.log('handleDataAvailable', event);
  if (event.data && event.data.size > 0) {
    recordedBlobs.push(event.data);
  }
}

function handleSuccess(stream) {
  recordButton.disabled = false;
  console.log('getUserMedia() got stream:', stream);
  window.stream = stream;

    videoElement.srcObject = stream;
}

async function init(constraints) {
  try {
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    handleSuccess(stream);
  } catch (e) {
    console.error('navigator.getUserMedia error:', e);
    errorMsgElement.innerHTML = `navigator.getUserMedia error:${e.toString()}`;
  }
}

document.querySelector('button#start').addEventListener('click', async () => {
  const hasEchoCancellation = document.querySelector('#echoCancellation').checked;
  const constraints = {
    audio: {
      echoCancellation: {exact: hasEchoCancellation}
    },
    video:true
  };
  console.log('Using media constraints:', constraints);
  recordButton.disabled = false;
  
  start();
  await init(constraints);
});
var canvas = document.getElementById("canvas");
var photos = document.getElementById("photos");
function clearphoto() {
  var context = canvas.getContext('2d');
  context.fillStyle = "#AAA";
  context.fillRect(0, 0, canvas.width, canvas.height);

  var data = canvas.toDataURL('image/png');
  photos.setAttribute('src', data);
}

// Capture a photo by fetching the current contents of the video
// and drawing it into a canvas, then converting that to a PNG
// format data URL. By drawing it on an offscreen canvas and then
// drawing that to the screen, we can change its size and/or apply
// other changes before drawing it.

function takepicture() {
  var width = 320;    // We will scale the photo width to this
  var height = 240;  
  var context = canvas.getContext('2d');
  if (width && height) {
      canvas.width = width;
      canvas.height = height;
      context.drawImage(videoElement, 0, 0, width, height);

      var data = canvas.toDataURL('image/png');
      // photos.setAttribute('src', data);

      
      downloadButton.disabled=false;
      downloadButton.href = data;

  } else {
      clearphoto();
  }
}

takephoto.addEventListener('click',()=>
{
takepicture();
});