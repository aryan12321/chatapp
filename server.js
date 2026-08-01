const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const mongoose = require('mongoose');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  maxHttpBufferSize: 15 * 1024 * 1024
});

const PORT = process.env.PORT || 3000;
const PIN = process.env.CHAT_PIN || '1234';
const MONGO_URI = process.env.MONGO_URI;
const ROOM = 'main';
const MAX_MESSAGES = 200;

// --- MongoDB schema ---
const msgSchema = new mongoose.Schema({
  type: { type: String, default: 'text' },
  user: String,
  text: String,
  dataUrl: String,
  caption: String,
  time: String
});
const Message = mongoose.model('Message', msgSchema);

// --- Connect to MongoDB ---
mongoose.connect(MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB error:', err));

// --- Express ---
app.use(express.static(path.join(__dirname, 'public')));

// --- Socket.io ---
io.on('connection', (socket) => {
  socket.verified = false;

  socket.on('verify-pin', (pin, cb) => {
    if (pin === PIN) { socket.verified = true; cb({ ok: true }); }
    else { cb({ ok: false }); }
  });

  socket.on('join', async (username) => {
    if (!socket.verified) return;
    socket.username = username;
    socket.join(ROOM);
    // Load last 200 messages from DB
    const history = await Message.find().sort({ _id: 1 }).limit(MAX_MESSAGES).lean();
    socket.emit('history', history);
    io.to(ROOM).emit('system', `${username} joined`);
  });

  socket.on('message', async (text) => {
    if (!socket.verified || !socket.username) return;
    const msg = new Message({ type: 'text', user: socket.username, text, time: new Date().toISOString() });
    await msg.save();
    // Trim old messages
    const count = await Message.countDocuments();
    if (count > MAX_MESSAGES) {
      const oldest = await Message.find().sort({ _id: 1 }).limit(count - MAX_MESSAGES);
      await Message.deleteMany({ _id: { $in: oldest.map(m => m._id) } });
    }
    io.to(ROOM).emit('message', msg);
  });

  socket.on('image', async ({ dataUrl, caption }) => {
    if (!socket.verified || !socket.username) return;
    if (!dataUrl || !dataUrl.startsWith('data:image/')) return;
    if (dataUrl.length > 14 * 1024 * 1024) return;
    const msg = new Message({ type: 'image', user: socket.username, dataUrl, caption: caption || '', time: new Date().toISOString() });
    await msg.save();
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
