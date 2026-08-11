window.TL = window.TL || {};

TL.UI = (function () {
  var modalRoot = null;
  var toastRoot = null;

  function ensureRoots() {
    if (!modalRoot) {
      modalRoot = document.createElement("div");
      modalRoot.id = "tl-modal-root";
      document.body.appendChild(modalRoot);
    }
    if (!toastRoot) {
      toastRoot = document.createElement("div");
      toastRoot.id = "tl-toast-root";
      document.body.appendChild(toastRoot);
    }
  }

  function modal(options) {
    ensureRoots();
    return new Promise(function (resolve) {
      var wrap = document.createElement("div");
      wrap.className = "tl-modal-wrap";
      var box = document.createElement("div");
      box.className = "tl-modal";
      var html = '<div class="tl-modal-title">' + TL.escapeHtml(options.title || "") + "</div>";
      if (options.text) html += '<div class="tl-modal-text">' + TL.escapeHtml(options.text) + "</div>";
      if (options.body) html += '<div class="tl-modal-body"></div>';
      box.innerHTML = html;
      var bodyEl = box.querySelector(".tl-modal-body");
      var btnRow = document.createElement("div");
      btnRow.className = "tl-modal-btns";
      box.appendChild(btnRow);
      function close(val) {
        if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
        resolve(val);
      }
      if (options.buttons) {
        options.buttons.forEach(function (b, i) {
          var btn = document.createElement("button");
          btn.className = "tl-btn " + (b.primary ? "tl-btn-primary" : "");
          btn.textContent = b.label;
          btn.addEventListener("click", function () { close(b.value !== undefined ? b.value : i); });
          btnRow.appendChild(btn);
        });
      } else {
        var ok = document.createElement("button");
        ok.className = "tl-btn tl-btn-primary";
        ok.textContent = options.okText || TL.t("common.ok");
        ok.addEventListener("click", function () { close(true); });
        btnRow.appendChild(ok);
        if (options.cancelText) {
          var no = document.createElement("button");
          no.className = "tl-btn";
          no.textContent = options.cancelText;
          no.addEventListener("click", function () { close(false); });
          btnRow.appendChild(no);
        }
      }
      if (options.body) {
        options.body(bodyEl);
      }
      wrap.appendChild(box);
      modalRoot.appendChild(wrap);
      wrap.addEventListener("click", function (e) {
        if (e.target === wrap && !options.locked) close(options.cancelValue === undefined ? null : options.cancelValue);
      });
    });
  }

  function askChoice(q) {
    ensureRoots();
    return new Promise(function (resolve) {
      var wrap = document.createElement("div");
      wrap.className = "tl-modal-wrap";
      var box = document.createElement("div");
      box.className = "tl-modal";
      box.innerHTML = '<div class="tl-modal-title">' + TL.escapeHtml(q.title || TL.t("common.choose")) + "</div>" +
        (q.text ? '<div class="tl-modal-text">' + TL.escapeHtml(q.text) + "</div>" : "") +
        '<div class="tl-modal-btns"></div>';
      var row = box.querySelector(".tl-modal-btns");
      q.options.forEach(function (o, i) {
        var btn = document.createElement("button");
        btn.className = "tl-btn tl-btn-choice";
        btn.textContent = o;
        btn.addEventListener("click", function () {
          if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
          resolve(i);
        });
        row.appendChild(btn);
      });
      wrap.appendChild(box);
      modalRoot.appendChild(wrap);
      wrap.addEventListener("click", function (e) {
        if (e.target === wrap) {
          if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
          resolve(null);
        }
      });
    });
  }

  function askTarget(q) {
    ensureRoots();
    return new Promise(function (resolve) {
      var wrap = document.createElement("div");
      wrap.className = "tl-modal-wrap";
      var box = document.createElement("div");
      box.className = "tl-modal tl-modal-target";
      box.innerHTML = '<div class="tl-modal-title">' + TL.escapeHtml(q.title || TL.t("common.selectTarget")) + "</div>" +
        (q.text ? '<div class="tl-modal-text">' + TL.escapeHtml(q.text) + "</div>" : "") +
        '<div class="tl-target-grid"></div>';
      var grid = box.querySelector(".tl-target-grid");
      (q.targets || []).forEach(function (t) {
        var btn = document.createElement("button");
        btn.className = "tl-btn tl-target-item";
        if (t.type === "char") {
          var data = CHAR_INDEX[t.id];
          btn.innerHTML = '<img src="assets/chara_live/' + encodeURIComponent(t.id) + '.png" alt=""><span>' + TL.escapeHtml(t.label) + "</span>";
        } else {
          var locData = LOC_INDEX[t.id];
          btn.innerHTML = (t.id === "distant"
            ? '<div class="tl-target-ph">∞</div>'
            : '<img src="assets/board/' + encodeURIComponent(t.id) + '.png" alt="">') +
            "<span>" + TL.escapeHtml(t.label) + "</span>";
        }
        btn.addEventListener("click", function () {
          if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
          resolve(t);
        });
        grid.appendChild(btn);
      });
      var cancel = document.createElement("button");
      cancel.className = "tl-btn";
      cancel.textContent = TL.t("common.cancel");
      cancel.addEventListener("click", function () {
        if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
        resolve(null);
      });
      box.appendChild(cancel);
      wrap.appendChild(box);
      modalRoot.appendChild(wrap);
      wrap.addEventListener("click", function (e) {
        if (e.target === wrap) {
          if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
          resolve(null);
        }
      });
    });
  }

  function confirm(q) {
    return askChoice({
      title: q.title || TL.t("common.confirm"),
      text: q.text,
      options: [q.okText || TL.t("common.yes"), q.cancelText || TL.t("common.no")]
    }).then(function (i) {
      return i === 0;
    });
  }

  function toast(msg, type) {
    ensureRoots();
    var el = document.createElement("div");
    el.className = "tl-toast " + (type || "info");
    el.textContent = msg;
    toastRoot.appendChild(el);
    setTimeout(function () {
      el.classList.add("tl-toast-out");
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 300);
    }, 2600);
  }

  function notify(msg) { toast(msg, "info"); }

  function io() {
    return {
      log: function (msg) { /* 引擎日誌由遊戲界面處理 */ },
      askChoice: askChoice,
      askTarget: askTarget,
      confirm: confirm
    };
  }

  return {
    modal: modal,
    askChoice: askChoice,
    askTarget: askTarget,
    confirm: confirm,
    toast: toast,
    notify: notify,
    io: io
  };
})();
