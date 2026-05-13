/* Reusable search box UI. */

// search box maker
{
let sequence = 0;

  app.searchBox = {
    create(options) {
      const config = options || {};
      const wrapper = document.createElement("div");
      const id = `global-search-${sequence += 1}`;
      const label = config.label || "Search";
      const value = String(config.value || "");
      const emit = typeof config.onChange === "function"
        ? (config.debounceMs === 0
          ? config.onChange
          : app.help.debounce(config.onChange, config.debounceMs ?? 80))
        : null;

      wrapper.className = `global-search ${config.className || ""}`.trim();
      wrapper.innerHTML = `
        <label class="sr-only" for="${id}">${app.help.escapeHtml(label)}</label>
        <input
          id="${id}"
          class="input global-search-input"
          type="search"
          autocomplete="off"
          spellcheck="false"
          placeholder="${app.help.escapeHtml(config.placeholder || "Search records")}"
          value="${app.help.escapeHtml(value)}"
        >
        <button class="global-search-clear" type="button" data-search-clear aria-label="Clear search" hidden>Clear</button>
      `;

      const input = wrapper.querySelector("input");
      const clear = wrapper.querySelector("[data-search-clear]");

      function updateClearState() {
        clear.hidden = input.value.length === 0;
      }

      input.addEventListener("input", () => {
        updateClearState();
        if (emit) {
          emit(input.value);
        }
      });

      clear.addEventListener("click", () => {
        input.value = "";
        updateClearState();
        input.focus();
        if (emit) {
          emit("");
        }
      });

      updateClearState();

      return {
        element: wrapper,
        input,
        setValue(nextValue, notify) {
          input.value = String(nextValue || "");
          updateClearState();
          if (notify && emit) {
            emit(input.value);
          }
        },
        focus() {
          input.focus();
        }
      };
    }
  };
}



