# Private Chat — Self-Hosted

A minimal 2-person chat running on your PC, exposed via Cloudflare Tunnel.

## Setup

### 1. Install Node.js (if not already)
Download from https://nodejs.org (v18+)

### 2. Install dependencies
```bash
npm install
```

### 3. Run the server
```bash
node server.js
```
Chat runs at http://localhost:3000

---

## Expose to the internet via Cloudflare Tunnel (free)

### Install cloudflared
- Windows: https://github.com/cloudflare/cloudflared/releases — download `cloudflared-windows-amd64.exe`
- Linux: `sudo apt install cloudflared` or download binary
- Mac: `brew install cloudflare/cloudflare/cloudflared`

### Quick tunnel (no login needed, temporary URL)
```bash
cloudflared tunnel --url http://localhost:3000
```
This gives you a URL like `https://abc-def-xyz.trycloudflare.com`
Share this with your friend. Valid as long as the terminal is open.

### Permanent URL using your own domain (optional)
1. Login: `cloudflared tunnel login`
2. Create tunnel: `cloudflared tunnel create my-chat`
3. Route: `cloudflared tunnel route dns my-chat chat.yourdomain.com`
4. Run: `cloudflared tunnel run my-chat`

---

## Keep it running (Windows)
Use PM2:
```bash
npm install -g pm2
pm2 start server.js --name chat
pm2 startup   # auto-start on reboot
```

## Keep it running (Linux)
```bash
pm2 start server.js --name chat
pm2 startup && pm2 save
```

---

## Files
```
chat-app/
├── server.js        # Node + Socket.io backend
├── public/
│   └── index.html   # Frontend (served as static)
└── package.json
```

## Notes
- Messages are stored in memory only (lost on restart). Add SQLite if you want persistence.
- No auth — anyone with the URL can join. Add a password prompt if needed.
