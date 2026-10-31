/* Only the APIs used by this game, with an ES2017 / Chrome 61 baseline. */
(function () {
  'use strict';
  window.MiniCompat = {
    onMedia: function (query, handler) {
      if (query.addEventListener) query.addEventListener('change', handler);
      else if (query.addListener) query.addListener(handler);
    }
  };
  if (window.CanvasRenderingContext2D && !CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, radius) {
      var r = Math.min(Number(radius) || 0, Math.abs(w) / 2, Math.abs(h) / 2);
      this.moveTo(x + r, y); this.lineTo(x + w - r, y);
      this.quadraticCurveTo(x + w, y, x + w, y + r); this.lineTo(x + w, y + h - r);
      this.quadraticCurveTo(x + w, y + h, x + w - r, y + h); this.lineTo(x + r, y + h);
      this.quadraticCurveTo(x, y + h, x, y + h - r); this.lineTo(x, y + r);
      this.quadraticCurveTo(x, y, x + r, y); this.closePath(); return this;
    };
  }
  var dialog = document.getElementById('result');
  if (dialog && typeof dialog.showModal !== 'function') {
    var backdrop = document.createElement('div'); backdrop.className = 'dialog-backdrop'; backdrop.hidden = true;
    document.body.appendChild(backdrop); dialog.classList.add('legacy-dialog');
    dialog.setAttribute('role', 'dialog'); dialog.setAttribute('aria-modal', 'true');
    if (!('open' in dialog)) Object.defineProperty(dialog, 'open', {get:function () {return dialog.hasAttribute('open');}});
    dialog.showModal = function () {dialog.setAttribute('open', ''); backdrop.hidden = false; document.getElementById('retry').focus();};
    dialog.close = function () {dialog.removeAttribute('open'); backdrop.hidden = true; dialog.dispatchEvent(new Event('close'));};
    document.addEventListener('keydown', function (event) {
      if (!dialog.open) return;
      if (event.key === 'Escape') {event.preventDefault(); dialog.close();}
      if (event.key === 'Tab') {
        var buttons = dialog.querySelectorAll('button:not(:disabled)'), first = buttons[0], last = buttons[buttons.length - 1];
        if (event.shiftKey && document.activeElement === first) {event.preventDefault(); last.focus();}
        else if (!event.shiftKey && document.activeElement === last) {event.preventDefault(); first.focus();}
      }
    });
  }
})();
