/* Popup modal and confirm dialog helpers. */

// popup windows
{
function closeTopModal() {
    const modal = document.querySelector(".modal-backdrop");
    if (modal) {
      modal.remove();
    }
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeTopModal();
    }
  });

  app.popup = {
    open(options) {
      const config = options || {};
      closeTopModal();

      const backdrop = document.createElement("div");
      backdrop.className = "modal-backdrop";
      backdrop.innerHTML = `
        <section class="modal-card ${config.size === "large" ? "modal-large" : ""}" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <header class="modal-header">
            <h2 class="modal-title" id="modal-title">${app.help.escapeHtml(config.title || "RetailOps")}</h2>
            <button class="icon-btn" type="button" data-modal-close aria-label="Close dialog">x</button>
          </header>
          <div class="modal-body"></div>
          <footer class="modal-footer"></footer>
        </section>
      `;

      const body = backdrop.querySelector(".modal-body");
      const footer = backdrop.querySelector(".modal-footer");

      if (typeof config.content === "string") {
        body.innerHTML = config.content;
      } else if (config.content) {
        body.appendChild(config.content);
      }

      const actions = config.actions || [{ label: "Close", variant: "secondary", action: closeTopModal }];
      actions.forEach((action) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `btn btn-${action.variant || "secondary"}`;
        button.textContent = action.label;
        button.addEventListener("click", () => {
          if (action.action) {
            action.action(closeTopModal);
          } else {
            closeTopModal();
          }
        });
        footer.appendChild(button);
      });

      backdrop.addEventListener("click", (event) => {
        if (event.target === backdrop || event.target.matches("[data-modal-close]")) {
          closeTopModal();
        }
      });

      document.body.appendChild(backdrop);
      const focusTarget = backdrop.querySelector("input, select, textarea, button");
      if (focusTarget) {
        focusTarget.focus();
      }

      return {
        close: closeTopModal,
        element: backdrop
      };
    },

    confirm(options) {
      return new Promise((resolve) => {
        app.popup.open({
          title: options.title || "Confirm action",
          content: `<p class="section-copy">${app.help.escapeHtml(options.message || "Are you sure?")}</p>`,
          actions: [
            {
              label: options.cancelLabel || "Cancel",
              variant: "secondary",
              action: (close) => {
                close();
                resolve(false);
              }
            },
            {
              label: options.confirmLabel || "Confirm",
              variant: options.danger ? "danger" : "primary",
              action: (close) => {
                close();
                resolve(true);
              }
            }
          ]
        });
      });
    }
  };
}



