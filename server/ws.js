// 極簡 WebSocket（RFC 6455）— 無第三方依賴
// 提供：WebSocketServer（掛在 http server 的 upgrade 事件上）與 WSClient（測試用）
const crypto = require("crypto");
const http = require("http");

const WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

function encodeFrame(opcode, payload, mask) {
  const data = Buffer.isBuffer(payload) ? payload : Buffer.from(String(payload), "utf8");
  const len = data.length;
  let header;
  if (len < 126) {
    header = Buffer.alloc(2);
    header[1] = len;
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }
  header[0] = 0x80 | opcode; // FIN
  if (mask) {
    header[1] |= 0x80;
    const key = crypto.randomBytes(4);
    const out = Buffer.alloc(header.length + 4 + len);
    header.copy(out, 0);
    key.copy(out, header.length);
    for (let i = 0; i < len; i++) out[header.length + 4 + i] = data[i] ^ key[i % 4];
    return out;
  }
  return Buffer.concat([header, data]);
}

function decodeFrames(buf) {
  // 回傳 { frames: [...], rest: Buffer }
  const frames = [];
  let offset = 0;
  while (offset + 2 <= buf.length) {
    const b0 = buf[offset];
    const b1 = buf[offset + 1];
    const fin = (b0 & 0x80) !== 0;
    const opcode = b0 & 0x0f;
    const masked = (b1 & 0x80) !== 0;
    let len = b1 & 0x7f;
    let headerLen = 2;
    if (len === 126) {
      if (offset + 4 > buf.length) break;
      len = buf.readUInt16BE(offset + 2);
      headerLen = 4;
    } else if (len === 127) {
      if (offset + 10 > buf.length) break;
      len = Number(buf.readBigUInt64BE(offset + 2));
      headerLen = 10;
    }
    let maskKey = null;
    if (masked) {
      if (offset + headerLen + 4 > buf.length) break;
      maskKey = buf.slice(offset + headerLen, offset + headerLen + 4);
      headerLen += 4;
    }
    if (offset + headerLen + len > buf.length) break; // 不完整，等待更多資料
    const payload = Buffer.alloc(len);
    for (let i = 0; i < len; i++) {
      payload[i] = buf[offset + headerLen + i] ^ (maskKey ? maskKey[i % 4] : 0);
    }
    frames.push({ fin, opcode, payload });
    offset += headerLen + len;
  }
  return { frames, rest: buf.slice(offset) };
}

class WSConnection {
  constructor(socket, onMessage, onClose) {
    this.socket = socket;
    this.onMessage = onMessage;
    this.onClose = onClose;
    this.buffer = Buffer.alloc(0);
    this.fragments = [];
    this.fragOpcode = null;
    socket.on("data", (chunk) => this._onData(chunk));
    socket.on("close", () => this.onClose && this.onClose());
    socket.on("error", () => {});
  }
  _onData(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    const { frames, rest } = decodeFrames(this.buffer);
    this.buffer = rest;
    for (const f of frames) {
      if (f.opcode === 0x8) { // close
        try { this.socket.end(encodeFrame(0x8, Buffer.alloc(0), false)); } catch (e) {}
        return;
      }
      if (f.opcode === 0x9) { // ping -> pong
        this.sendRaw(encodeFrame(0xa, f.payload, false));
        continue;
      }
      if (f.opcode === 0x1 || f.opcode === 0x2) { // text / binary
        this.fragments = [f.payload];
        this.fragOpcode = f.opcode;
        if (f.fin) this._emit();
      } else if (f.opcode === 0x0) { // continuation
        this.fragments.push(f.payload);
        if (f.fin) this._emit();
      }
    }
  }
  _emit() {
    const payload = Buffer.concat(this.fragments);
    this.fragments = [];
    this.fragOpcode = null;
    try {
      this.onMessage(payload.toString("utf8"));
    } catch (e) {}
  }
  sendRaw(buf) {
    if (this.socket.writable) this.socket.write(buf);
  }
  send(msg) {
    this.sendRaw(encodeFrame(0x1, String(msg), false));
  }
  close() {
    try { this.sendRaw(encodeFrame(0x8, Buffer.alloc(0), false)); } catch (e) {}
    try { this.socket.end(); } catch (e) {}
  }
}

class WebSocketServer {
  // attach(httpServer, { path }) -> 攔截 upgrade
  constructor(httpServer, opts) {
    this.opts = opts || {};
    this.path = this.opts.path || "/ws";
    this.connections = new Set();
    httpServer.on("upgrade", (req, socket, head) => {
      const url = req.url || "/";
      if (url.split("?")[0] !== this.path) {
        socket.destroy();
        return;
      }
      const key = req.headers["sec-websocket-key"];
      if (!key) { socket.destroy(); return; }
      const accept = crypto.createHash("sha1").update(key + WS_GUID).digest("base64");
      socket.write(
        "HTTP/1.1 101 Switching Protocols\r\n" +
        "Upgrade: websocket\r\n" +
        "Connection: Upgrade\r\n" +
        "Sec-WebSocket-Accept: " + accept + "\r\n\r\n"
      );
      if (head && head.length) socket.unshift(head);
      const conn = new WSConnection(socket, (msg) => {
        if (this.onMessage) this.onMessage(conn, msg);
      }, () => {
        this.connections.delete(conn);
        if (this.onClose) this.onClose(conn);
      });
      this.connections.add(conn);
      if (this.onConnection) this.onConnection(conn);
    });
  }
  broadcast(msg, except) {
    const s = JSON.stringify(msg);
    this.connections.forEach((c) => {
      if (c !== except) c.send(s);
    });
  }
}

class WSClient {
  // 供 Node 測試使用
  constructor(url) {
    this.url = url;
    this.socket = null;
    this.buffer = Buffer.alloc(0);
    this.fragments = [];
    this.fragOpcode = null;
    this.handlers = {};
  }
  connect(timeout) {
    return new Promise((resolve, reject) => {
      const u = new URL(this.url);
      const key = crypto.randomBytes(16).toString("base64");
      const req = http.request({
        hostname: u.hostname,
        port: u.port,
        path: u.pathname || "/ws",
        headers: {
          Connection: "Upgrade",
          Upgrade: "websocket",
          "Sec-WebSocket-Version": "13",
          "Sec-WebSocket-Key": key
        }
      });
      req.on("upgrade", (res, socket) => {
        this.socket = socket;
        socket.on("data", (chunk) => this._onData(chunk));
        socket.on("close", () => this.handlers.close && this.handlers.close());
        resolve(this);
      });
      req.on("error", reject);
      req.end();
    });
  }
  _onData(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    const { frames, rest } = decodeFrames(this.buffer);
    this.buffer = rest;
    for (const f of frames) {
      if (f.opcode === 0x9) { this.sendRaw(encodeFrame(0xa, f.payload, true)); continue; }
      if (f.opcode === 0x8) { this.close(); continue; }
      if (f.opcode === 0x1 || f.opcode === 0x2) {
        this.fragments = [f.payload];
        this.fragOpcode = f.opcode;
        if (f.fin) this._emit();
      } else if (f.opcode === 0x0) {
        this.fragments.push(f.payload);
        if (f.fin) this._emit();
      }
    }
  }
  _emit() {
    const payload = Buffer.concat(this.fragments);
    this.fragments = [];
    if (this.handlers.message) this.handlers.message(payload.toString("utf8"));
  }
  sendRaw(buf) {
    if (this.socket && this.socket.writable) this.socket.write(buf);
  }
  send(msg) {
    this.sendRaw(encodeFrame(0x1, String(msg), true));
  }
  on(evt, fn) { this.handlers[evt] = fn; }
  close() {
    try { this.sendRaw(encodeFrame(0x8, Buffer.alloc(0), true)); } catch (e) {}
    try { this.socket && this.socket.end(); } catch (e) {}
  }
}

module.exports = { WebSocketServer, WSClient, encodeFrame, decodeFrames };
