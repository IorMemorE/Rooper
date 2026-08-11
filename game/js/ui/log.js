// 事件紀錄面板
window.TL = window.TL || {};
TL.UI = TL.UI || {};

TL.UI.Log = (function () {
  var S = TL.UI.state;

  function renderLog() {
    var st = S.game.state;
    var box = TL.UI.$("log-panel");
    var shown = S.logReveal == null ? st.log.length : Math.max(0, Math.min(S.logReveal, st.log.length));
    var html = st.log.slice(0, shown).map(function (e) {
      return '<div class="log-entry"><span class="tag">' + e.loop + "-" + e.day + "</span>" + TL.escapeHtml(e.text) + "</div>";
    }).join("");
    box.innerHTML = html || '<div style="color:var(--text-dim);font-size:14px;">' + TL.t("game.logHint") + "</div>";
    box.scrollTop = box.scrollHeight;
  }

  return { renderLog: renderLog };
})();
