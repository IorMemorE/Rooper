// 多人聯機客戶端層（WebSocket）
window.TL = window.TL || {};
window.TL.Net = (function () {
  var ws = null;
  var connected = false;
  var playerId = null;
  var perspective = "mm"; // 當前視角：mm/a/b/c
  var slots = [];          // 本玩家擁有的英雄
  var guessRoles = null;   // 最終決戰的身份選項
  var session = null;      // {url, room, playerId, name, avatar}
  var handlers = {};
  var reconnectTimer = null;
  var closedByUser = false;
  var status = "idle";       // idle | connecting | connected | error
  var errorNotified = false;
  var reconnectCount = 0;
  var wsUrl = "";

  function setStatus(s) {
    status = s;
    emit("status", s);
  }

  function saveSession() {
    try { sessionStorage.setItem("tl_net_session", JSON.stringify(session)); } catch (e) {}
  }
  function loadSession() {
    try {
      var s = JSON.parse(sessionStorage.getItem("tl_net_session") || "null");
      if (s && typeof s.url === "string" && s.room) session = s;
    } catch (e) {}
    return session;
  }
  function clearSession() {
    try { sessionStorage.removeItem("tl_net_session"); } catch (e) {}
    session = null;
  }

  function emit(evt) {
    var args = Array.prototype.slice.call(arguments, 1);
    (handlers[evt] || []).forEach(function (fn) { try { fn.apply(null, args); } catch (e) {} });
  }
  function on(evt, fn) {
    (handlers[evt] = handlers[evt] || []).push(fn);
  }

  function connect(url, room, name, avatar) {
    if (ws) { try { ws.close(); } catch (e) {} }
    session = { url: url, room: room, playerId: playerId, name: name, avatar: avatar };
    saveSession();
    open();
  }

  function resume() {
    if (!loadSession()) return false;
    open();
    return true;
  }

  function open() {
    if (!session) return;
    var url = session.url;
    if (url.indexOf("ws") !== 0) {
      url = (location.protocol === "https:" ? "wss://" : "ws://") + location.host + "/ws";
    }
    wsUrl = url;
    setStatus("connecting");
    if (location.protocol === "file:") {
      failOnce(TL.t("net.fileMode"));
      return;
    }
    try { ws = new WebSocket(url); } catch (e) {
      failOnce(TL.t("net.openFail", { msg: e.message }));
      return;
    }
    ws.onopen = function () {
      connected = true;
      errorNotified = false;
      reconnectCount = 0;
      setStatus("connected");
      emit("open");
      send({ type: session.room ? "join" : "create", room: session.room, name: session.name, avatar: session.avatar, playerId: session.playerId });
    };
    ws.onmessage = function (e) {
      var msg;
      try { msg = JSON.parse(e.data); } catch (err) { return; }
      handle(msg);
    };
    ws.onclose = function () {
      connected = false;
      setStatus("error");
      emit("close");
      if (closedByUser) return;
      clearTimeout(reconnectTimer);
      var delay = Math.min(10000, 2500 * Math.pow(1.6, reconnectCount));
      reconnectCount++;
      reconnectTimer = setTimeout(open, delay);
    };
    ws.onerror = function () {
      connected = false;
      setStatus("error");
      failOnce(TL.t("net.wsFail", { url: wsUrl }));
    };
  }

  function failOnce(msg) {
    if (errorNotified) return;
    errorNotified = true;
    emit("error", msg);
  }

  function handle(msg) {
    if (msg.type === "welcome") {
      playerId = msg.id;
      if (session) { session.playerId = playerId; saveSession(); }
      emit("welcome", msg);
    } else if (msg.type === "room") {
      if (session && !session.room) { session.room = msg.room.code; saveSession(); }
      emit("room", msg.room);
    } else if (msg.type === "view") {
      slots = msg.slots || slots;
      guessRoles = msg.guessRoles || null;
      if (slots.indexOf(perspective) < 0) {
        perspective = slots[0] || "mm";
      }
      emit("view", msg);
    } else if (msg.type === "chat") {
      emit("chat", msg);
    } else if (msg.type === "prompt") {
      emit("prompt", msg);
    } else if (msg.type === "error") {
      emit("error", msg.msg || TL.t("net.error"));
    }
  }

  function send(obj) {
    if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj));
  }

  function action(name, payload) {
    var obj = { type: "action", action: name };
    for (var k in (payload || {})) obj[k] = payload[k];
    send(obj);
  }
  function promptReply(id, value) {
    send({ type: "prompt_reply", id: id, value: value });
  }
  function chat(text) {
    send({ type: "chat", text: text });
  }
  function assign(slot, playerId) {
    send({ type: "assign", slot: slot, playerId: playerId || null });
  }
  function selectScript(presetId, script) {
    send({ type: "select_script", presetId: presetId || null, script: script || null });
  }
  function startGame() {
    send({ type: "start" });
  }
  function setAvatar(name) {
    send({ type: "avatar", avatar: name });
  }
  function setPerspective(slot) {
    if (slots.indexOf(slot) < 0) return;
    perspective = slot;
    emit("perspective", slot);
  }
  function leave() {
    closedByUser = true;
    try { if (ws) ws.close(); } catch (e) {}
    clearSession();
  }

  setInterval(function () {
    if (connected) send({ type: "ping" });
  }, 20000);

  return {
    connect: connect,
    resume: resume,
    action: action,
    promptReply: promptReply,
    chat: chat,
    assign: assign,
    selectScript: selectScript,
    startGame: startGame,
    setAvatar: setAvatar,
    setPerspective: setPerspective,
    on: on,
    leave: leave,
    loadSession: loadSession,
    clearSession: clearSession,
    get connected() { return connected; },
    get playerId() { return playerId; },
    get perspective() { return perspective; },
    get slots() { return slots; },
    get guessRoles() { return guessRoles; },
    get status() { return status; },
    get wsUrl() { return wsUrl; },
    get session() { return session; }
  };
})();
