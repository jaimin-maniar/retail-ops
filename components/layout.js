(function (app) {
  function allowedRoutes(user) {
    return app.config.routes.filter((route) => app.router.hasAccess(route, user));
  }

  function sidebar(user, currentRoute) {
    const groups = app.helpers.groupBy(allowedRoutes(user), (route) => route.section);
    return `
      <aside class="sidebar" data-sidebar>
        <div class="brand">
          <img src="assets/logo-mark.svg" alt="RetailOps">
          <div>
            <span class="brand-title">RetailOps</span>
            <span class="brand-subtitle">Replenishment Suite</span>
          </div>
        </div>
        <nav class="nav" aria-label="Primary navigation">
          ${Object.entries(groups).map(([section, routes]) => `
            <div class="nav-section-label">${app.helpers.escapeHtml(section)}</div>
            ${routes.map((route) => `
              <a class="nav-link ${route.id === currentRoute.id ? "active" : ""}" href="${route.path}" data-nav-link>
                <span class="nav-icon">${app.helpers.escapeHtml(route.icon)}</span>
                <span>${app.helpers.escapeHtml(route.title)}</span>
              </a>
            `).join("")}
          `).join("")}
        </nav>
        <div class="sidebar-footer">
          <div class="user-card">
            <div class="user-name">${app.helpers.escapeHtml(user.Username)}</div>
            <div class="user-role">${app.helpers.escapeHtml(user.Role)}</div>
          </div>
        </div>
      </aside>
    `;
  }

  function attachShellEvents() {
    const sidebarElement = document.querySelector("[data-sidebar]");
    const menu = document.querySelector("[data-mobile-menu]");
    if (menu && sidebarElement) {
      menu.addEventListener("click", () => sidebarElement.classList.toggle("open"));
      document.querySelectorAll("[data-nav-link]").forEach((link) => {
        link.addEventListener("click", () => sidebarElement.classList.remove("open"));
      });
    }

    const logout = document.querySelector("[data-logout]");
    if (logout) {
      logout.addEventListener("click", () => {
        app.auth.logout();
        app.toast.success("Signed out successfully.");
      });
    }
  }

  app.layout = {
    renderLogin() {
      document.getElementById("app").innerHTML = `
        <main class="login-page">
          <section class="login-visual">
            <div>
              <p class="hero-eyebrow">Retail inventory planning</p>
              <h1>Corporate stock replenishment and promotion execution in one local workspace.</h1>
            </div>
            <p>Converted from the original console application into a browser-only ERP-style dashboard with JSON-backed simulation, role-aware navigation, and the same business calculations.</p>
            <div class="login-pattern" aria-hidden="true">
              ${Array.from({ length: 12 }).map((_, index) => `<div class="pattern-cell" style="opacity:${0.55 + (index % 4) * 0.1}"></div>`).join("")}
            </div>
          </section>
          <section class="login-panel">
            <div class="auth-card">
              <img src="assets/logo-mark.svg" alt="RetailOps" width="42" height="42">
              <h2>Sign in</h2>
              <p>Use one of the seeded console users to explore the converted workflows.</p>
              <form data-login-form class="app-form">
                <div class="field">
                  <label for="username">Username</label>
                  <input class="input" id="username" name="username" autocomplete="username" required>
                </div>
                <div class="field" style="margin-top:12px">
                  <label for="password">Password</label>
                  <input class="input" id="password" name="password" type="password" autocomplete="current-password" required>
                </div>
                <button class="btn btn-primary" type="submit" style="width:100%; margin-top:16px">Sign in</button>
              </form>
              <div class="demo-users">
                ${app.store.get("users").map((user) => `
                  <button class="demo-user" type="button" data-demo-user="${app.helpers.escapeHtml(user.Username)}" data-demo-password="${app.helpers.escapeHtml(user.Password)}">
                    <span>${app.helpers.escapeHtml(user.Username)} / ${app.helpers.escapeHtml(user.Password)}</span>
                    <span>${app.helpers.escapeHtml(user.Role)}</span>
                  </button>
                `).join("")}
              </div>
            </div>
          </section>
        </main>
      `;

      const form = document.querySelector("[data-login-form]");
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        const data = new FormData(form);
        try {
          app.auth.login(data.get("username"), data.get("password"));
          app.toast.success(`Welcome ${app.store.getUser().Username}.`);
          window.location.hash = "#/dashboard";
        } catch (error) {
          app.toast.error(error.message);
        }
      });

      document.querySelectorAll("[data-demo-user]").forEach((button) => {
        button.addEventListener("click", () => {
          form.username.value = button.dataset.demoUser;
          form.password.value = button.dataset.demoPassword;
          form.requestSubmit();
        });
      });
    },

    renderShell(route) {
      const user = app.store.getUser();
      document.getElementById("app").innerHTML = `
        <div class="app-shell">
          ${sidebar(user, route)}
          <main class="main">
            <header class="topbar">
              <div style="display:flex; align-items:center; gap:12px">
                <button class="icon-btn mobile-menu" type="button" data-mobile-menu aria-label="Open navigation">=</button>
                <div>
                  <h1 class="topbar-title">${app.helpers.escapeHtml(route.title)}</h1>
                  <div class="topbar-subtitle">${app.helpers.escapeHtml(route.subtitle)}</div>
                </div>
              </div>
              <div class="topbar-actions">
                <a class="btn btn-secondary" href="#/reports">Reports</a>
                <button class="btn btn-ghost" type="button" data-logout>Logout</button>
              </div>
            </header>
            <section class="content">
              <div data-route-outlet></div>
            </section>
          </main>
        </div>
      `;
      attachShellEvents();
    }
  };
})(window.RetailOps = window.RetailOps || {});
