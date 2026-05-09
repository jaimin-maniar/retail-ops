(function (app) {
  function ensureRegion() {
    let region = document.querySelector(".toast-region");
    if (!region) {
      region = document.createElement("div");
      region.className = "toast-region";
      region.setAttribute("aria-live", "polite");
      document.body.appendChild(region);
    }
    return region;
  }

  app.toast = {
    show(message, options) {
      const config = options || {};
      const region = ensureRegion();
      const toast = document.createElement("div");
      toast.className = `toast toast-${config.type || "info"}`;
      toast.innerHTML = `
        <strong>${app.helpers.escapeHtml(config.title || "RetailOps")}</strong>
        <span>${app.helpers.escapeHtml(message)}</span>
      `;
      region.appendChild(toast);

      window.setTimeout(() => {
        toast.remove();
      }, config.duration || 3600);
    },

    success(message, title) {
      app.toast.show(message, { type: "success", title: title || "Success" });
    },

    error(message, title) {
      app.toast.show(message, { type: "error", title: title || "Action failed" });
    },

    warning(message, title) {
      app.toast.show(message, { type: "warning", title: title || "Attention" });
    }
  };
})(window.RetailOps = window.RetailOps || {});
