const express = require("express");
const path = require('path');
const app = express();
// const router = express.Router();

const port = 3000;

const http = require("http");
const server = http.createServer(app);

const io = require("socket.io")(server);
// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Route to serve index1.html for the live wedding stream
app.get('/live_wedding', (req, res) => {
  res.sendFile(path.resolve(__dirname, './public/index1.html'));
});

// Other routes
app.get('/', (req, res) => {
  res.sendFile(path.resolve(__dirname, './public/index.html'));
});

app.get('/streamer', (req, res) => {
  res.sendFile(path.resolve(__dirname, './public/streamer.html'));
});

io.sockets.on("error", e => console.log(e));
server.listen(process.env.PORT || port, () => console.log(`Server is running on port ${port}`));

let broadcaster

io.sockets.on("connection", socket => {
  socket.on('chat message', function(msg){
  io.emit('chat message', msg);
});
  socket.on("broadcaster", () => {
    broadcaster = socket.id;
    socket.broadcast.emit("broadcaster");
  });
  socket.on("watcher", () => {
    socket.to(broadcaster).emit("watcher", socket.id);
  });
  socket.on("disconnect", () => {
    socket.to(broadcaster).emit("disconnectPeer", socket.id);
    // alert("user disconnected");
  });

  socket.on("offer", (id, message) => {
      socket.to(id).emit("offer", socket.id, message);
  });
  socket.on("answer", (id, message) => {
    socket.to(id).emit("answer", socket.id, message);
  });
  socket.on("candidate", (id, message) => {
    socket.to(id).emit("candidate", socket.id, message);
  });
});
