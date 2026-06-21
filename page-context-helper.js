(function() {
  if (typeof window.INSVPageHelper !== 'undefined') return;
  
  window.INSVPageHelper = {
    refreshView: function() {
      if (typeof $A !== 'undefined') {
        try {
          $A.get('e.force:refreshView').fire();
          return true;
        } catch (e) {
          console.warn('[INSV] Lightning refresh failed:', e);
        }
      }
      const btn = document.querySelector('button[name="refreshButton"]');
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    },
    
    acceptRecord: function() {
      if (typeof $A !== 'undefined') {
        try {
          const evt = $A.get('e.force:recordSave');
          if (evt) {
            evt.fire();
            return true;
          }
        } catch(e) {
          console.warn('[INSV] Lightning accept failed:', e);
        }
      }
      const buttons = document.querySelectorAll("button");
      for (const btn of buttons) {
        const text = (btn.textContent || "").trim();
        const ariaLabel = (btn.getAttribute("aria-label") || "").toLowerCase();
        const title = (btn.getAttribute("title") || "").toLowerCase();
        const hasAcceptText = /aceitar|accept|assumir|assume|take|tomar/i.test(text + " " + ariaLabel + " " + title);
        if (hasAcceptText && !btn.disabled && btn.offsetParent !== null) {
          btn.click();
          return true;
        }
      }
      return false;
    }
  };

  window.addEventListener('message', function(event) {
    if (event.origin !== window.location.origin) return;
    if (event.data && event.data.type === 'INSV_EXECUTE' && event.source === window) {
      const funcName = event.data.funcName;
      const requestId = event.data.requestId;
      if (
        window.INSVPageHelper &&
        Object.prototype.hasOwnProperty.call(window.INSVPageHelper, funcName) &&
        typeof window.INSVPageHelper[funcName] === 'function'
      ) {
        const result = window.INSVPageHelper[funcName]();
        window.postMessage({ type: 'INSV_RESULT', requestId, result }, window.location.origin);
      }
    }
  });
})();
