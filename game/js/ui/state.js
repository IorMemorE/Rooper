// UI 共享狀態（遊戲界面各模組共用；取代單一巨型閉包）
window.TL = window.TL || {};
TL.UI = TL.UI || {};

TL.UI.state = {
  game: null,
  pending: null,            // {kind:'mm'|'p', player, deck, cardId}
  pendingAbility: null,     // {kind:'mm'|'gw', entry, targets}
  suppressClick: false,     // 長按彈卡後抑制本次點擊
  hoverTimer: null,
  hoverCard: null,
  revealMode: false,        // 結算翻牌顯示
  feedCursor: 0,            // 已處理的結算事件數
  logReveal: null,          // 動畫期間逐步顯示的日誌條數
  tokenRects: {},           // 結算前角色位置快照（FLIP 動畫用）
  animBusy: false,
  secretOn: false,
  finalGuessShown: false,
  gameOverShown: false,
  SPEED: { slow: 1.7, normal: 1, fast: 0.45 },
  online: false,
  waitingAction: false,     // 聯機：等待伺服器回傳
  mirrorSeq: -1,
  lastFeedLen: 0,
  lastLogLen: 0,
  roomInfo: null,
  aiMode: false,            // 本地模擬對戰：AI 扮演劇作家
  aiBusy: false,
  notes: null,              // 主人公思考輔助（本地記錄）
  resolvePlays: null,       // 結算動畫期間的牌面快照（供分階段撤牌）
  settings: { anim: true, speed: "normal", aiDifficulty: "normal" }
};

TL.UI.$ = function (id) {
  return document.getElementById(id);
};

TL.UI.sleep = function (ms) {
  return new Promise(function (r) { setTimeout(r, ms); });
};

TL.UI.loadSettings = function () {
  try {
    var s = JSON.parse(localStorage.getItem("tl_settings") || "{}");
    Object.keys(s).forEach(function (k) { TL.UI.state.settings[k] = s[k]; });
  } catch (e) { /* ignore */ }
  return TL.UI.state.settings;
};

TL.UI.saveSettings = function () {
  try { localStorage.setItem("tl_settings", JSON.stringify(TL.UI.state.settings)); } catch (e) { /* ignore */ }
};
