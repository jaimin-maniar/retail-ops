(function (app) {
  const listeners = new Set();
  const state = {
    collections: {},
    currentUser: null,
    isLoaded: false
  };

  const storageKey = (name) => `${app.config.storagePrefix}.${name}`;

  async function loadJson(name, url) {
    const saved = localStorage.getItem(storageKey(name));
    if (saved) {
      return JSON.parse(saved);
    }

    // Browsers often block file:// JSON fetch. The generated seed mirror keeps
    // the double-click workflow working while preserving JSON files as source data.
    if (window.location.protocol !== "file:") {
      try {
        const response = await fetch(url, { cache: "no-store" });
        if (response.ok) {
          return response.json();
        }
      } catch (error) {
        console.warn(`Unable to fetch ${url}; using embedded seed data.`, error);
      }
    }

    return app.helpers.clone((window.RetailOpsSeedData || {})[name] || (name === "settings" ? {} : []));
  }

  function persist(name) {
    localStorage.setItem(storageKey(name), JSON.stringify(state.collections[name]));
  }

  function notify() {
    listeners.forEach((listener) => listener(app.helpers.clone(state.collections)));
  }

  app.store = {
    async load() {
      const entries = Object.entries(app.config.dataFiles);
      await Promise.all(entries.map(async ([name, url]) => {
        state.collections[name] = await loadJson(name, url);
      }));

      const savedUser = sessionStorage.getItem(`${app.config.storagePrefix}.sessionUser`);
      state.currentUser = savedUser ? JSON.parse(savedUser) : null;
      state.isLoaded = true;
      notify();
    },

    isLoaded() {
      return state.isLoaded;
    },

    get(name) {
      return app.helpers.clone(state.collections[name] || (name === "settings" ? {} : []));
    },

    set(name, value, options) {
      state.collections[name] = app.helpers.clone(value);
      if (!options || options.persist !== false) {
        persist(name);
      }
      notify();
    },

    update(name, updater) {
      const next = updater(app.helpers.clone(state.collections[name] || []));
      state.collections[name] = next;
      persist(name);
      notify();
      return app.helpers.clone(next);
    },

    getUser() {
      return state.currentUser ? app.helpers.clone(state.currentUser) : null;
    },

    setUser(user) {
      state.currentUser = user ? app.helpers.clone(user) : null;
      if (state.currentUser) {
        sessionStorage.setItem(`${app.config.storagePrefix}.sessionUser`, JSON.stringify(state.currentUser));
      } else {
        sessionStorage.removeItem(`${app.config.storagePrefix}.sessionUser`);
      }
      notify();
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    resetLocalData() {
      Object.keys(app.config.dataFiles).forEach((name) => {
        localStorage.removeItem(storageKey(name));
        state.collections[name] = app.helpers.clone((window.RetailOpsSeedData || {})[name] || (name === "settings" ? {} : []));
      });
      notify();
    }
  };
})(window.RetailOps = window.RetailOps || {});
