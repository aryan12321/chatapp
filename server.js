const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);

// Increase socket.io max buffer to ~15MB (base64 of 10MB file = ~13.3MB)
const io = new Server(server, {
  maxHttpBufferSize: 15 * 1024 * 1024
});

const PORT = process.env.PORT || 3000;
const PIN = process.env.CHAT_PIN || '1234';   // ← change this
const ROOM = 'main';
const HISTORY_FILE = path.join(__dirname, 'chat-history.json');
const MAX_MESSAGES = 200;
const MAX_FILE_B64 = 14 * 1024 * 1024; // ~10MB file in base64

// --- JSON file storage ---
function loadHistory() {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
    }
  } catch (e) { console.error('Failed to load history:', e.message); }
  return [];
}

function saveHistory(messages) {
  try {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(messages), 'utf8');
  } catch (e) { console.error('Failed to save history:', e.message); }
}

const messages = loadHistory();

// --- Express ---
app.use(express.static(path.join(__dirname, 'public')));

// --- Socket.io ---
io.on('connection', (socket) => {
  socket.verified = false;

  socket.on('verify-pin', (pin, cb) => {
    if (pin === PIN) { socket.verified = true; cb({ ok: true }); }
    else { cb({ ok: false }); }
  });

  socket.on('join', (username) => {
    if (!socket.verified) return;
    socket.username = username;
    socket.join(ROOM);
    socket.emit('history', messages);
    io.to(ROOM).emit('system', `${username} joined`);
  });

  socket.on('message', (text) => {
    if (!socket.verified || !socket.username) return;
    const msg = { user: socket.username, text, time: new Date().toISOString() };
    messages.push(msg);
    if (messages.length > MAX_MESSAGES) messages.shift();
    saveHistory(messages);
    io.to(ROOM).emit('message', msg);
  });

  socket.on('image', ({ dataUrl, caption }) => {
    if (!socket.verified || !socket.username) return;
    if (!dataUrl || !dataUrl.startsWith('data:image/')) return;
    if (dataUrl.length > MAX_FILE_B64) return;
    const msg = { type: 'image', user: socket.username, dataUrl, caption: caption || '', time: new Date().toISOString() };
    messages.push(msg);
    if (messages.length > MAX_MESSAGES) messages.shift();
    saveHistory(messages);
    io.to(ROOM).emit('image', msg);
  });

  socket.on('disconnect', () => {
    if (socket.username) io.to(ROOM).emit('system', `${socket.username} left`);
  });
});

server.listen(PORT, () => {
  console.log(`Chat running at http://localhost:${PORT}`);
  console.log(`PIN: ${PIN}`);
});
