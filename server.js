const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const PIN = process.env.CHAT_PIN || '1234';   // ← change this
const ROOM = 'main';
const HISTORY_FILE = path.join(__dirname, 'chat-history.json');
const MAX_MESSAGES = 200;

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
    if (pin === PIN) {
      socket.verified = true;
      cb({ ok: true });
    } else {
      cb({ ok: false });
    }
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

  socket.on('disconnect', () => {
    if (socket.username) {
      io.to(ROOM).emit('system', `${socket.username} left`);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Chat running at http://localhost:${PORT}`);
  console.log(`PIN: ${PIN}`);
});
