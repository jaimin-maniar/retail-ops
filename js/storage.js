/* Browser localStorage and sessionStorage data access. */

// local data storage
{
  const listeners = new Set();
  const state = {
    collections: {},
    currentUser: null,
    isLoaded: false
  };

  function getSessionKey() {
    return `${app.setup.storagePrefix}.sessionUser`;
  }

  function currentStoreId() {
    if (state.currentUser && state.currentUser.StoreId) {
      return window.RetailOpsAuth.cleanStoreId(state.currentUser.StoreId);
    }
    return "STORE1001";
  }

  function storageKey(name) {
    return `${app.setup.storagePrefix}.${currentStoreId()}.${name}`;
  }

  function addStoreId(name, value) {
    const storeId = currentStoreId();

    if (Array.isArray(value)) {
      return value.map((item) => {
        if (item && typeof item === "object") {
          return { ...item, StoreId: storeId };
        }
        return item;
      });
    }

    if (value && typeof value === "object") {
      return { ...value, StoreId: storeId };
    }

    return value;
  }

  function seedData(name) {
    if (name === "users" && window.RetailOpsAuth) {
      return window.RetailOpsAuth.getUsersForStore(currentStoreId());
    }

    const source = (window.RetailOpsSeedData || {})[name] || (name === "settings" ? {} : []);
    return addStoreId(name, app.help.clone(source));
  }

  function unwrapSavedData(name, savedText) {
    const saved = JSON.parse(savedText);

    if (saved && saved.storeId && Object.prototype.hasOwnProperty.call(saved, name)) {
      return addStoreId(name, saved[name]);
    }

    return addStoreId(name, saved);
  }

  async function loadSavedData(name) {
    const saved = localStorage.getItem(storageKey(name));
    if (saved) {
      return unwrapSavedData(name, saved);
    }
    return seedData(name);
  }

  function persist(name) {
    const wrapped = { storeId: currentStoreId() };
    wrapped[name] = state.collections[name];
    localStorage.setItem(storageKey(name), JSON.stringify(wrapped));
  }

  function notify() {
    listeners.forEach((listener) => listener(app.help.clone(state.collections)));
  }

  function readLoggedInUser() {
    if (window.RetailOpsAuth) {
      return window.RetailOpsAuth.getLoggedInUser();
    }

    const saved = localStorage.getItem("loggedInUser") || sessionStorage.getItem(getSessionKey());
    return saved ? JSON.parse(saved) : null;
  }

  app.data = {
    async load() {
      state.currentUser = readLoggedInUser();

      const entries = Object.keys(app.setup.dataFiles);
      for (let i = 0; i < entries.length; i += 1) {
        const name = entries[i];
        state.collections[name] = await loadSavedData(name);
      }

      state.isLoaded = true;
      notify();
    },

    isLoaded() {
      return state.isLoaded;
    },

    get(name) {
      return app.help.clone(state.collections[name] || (name === "settings" ? {} : []));
    },

    set(name, value, options) {
      state.collections[name] = addStoreId(name, app.help.clone(value));
      if (!options || options.persist !== false) {
        persist(name);
      }
      notify();
    },

    update(name, updater) {
      const next = updater(app.help.clone(state.collections[name] || []));
      state.collections[name] = addStoreId(name, next);
      persist(name);
      notify();
      return app.help.clone(state.collections[name]);
    },

    getUser() {
      return state.currentUser ? app.help.clone(state.currentUser) : null;
    },

    setUser(user) {
      state.currentUser = user ? app.help.clone(user) : null;
      if (state.currentUser) {
        localStorage.setItem("loggedInUser", JSON.stringify(state.currentUser));
        sessionStorage.setItem(getSessionKey(), JSON.stringify(state.currentUser));
      } else {
        localStorage.removeItem("loggedInUser");
        sessionStorage.removeItem(getSessionKey());
      }
      notify();
    },

    getStoreId() {
      return currentStoreId();
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    resetLocalData() {
      Object.keys(app.setup.dataFiles).forEach((name) => {
        localStorage.removeItem(storageKey(name));
        state.collections[name] = seedData(name);
      });
      notify();
    }
  };
}
