/* Application startup. */

// start the app
async function startApp() {
  function showLoading() {
    document.getElementById("app").innerHTML = `
      <main class="content">
        <div class="page-stack">
          <section class="grid grid-4">
            <div class="metric-card"><div class="skeleton"></div><div class="skeleton" style="height:32px"></div><div class="skeleton"></div></div>
            <div class="metric-card"><div class="skeleton"></div><div class="skeleton" style="height:32px"></div><div class="skeleton"></div></div>
            <div class="metric-card"><div class="skeleton"></div><div class="skeleton" style="height:32px"></div><div class="skeleton"></div></div>
            <div class="metric-card"><div class="skeleton"></div><div class="skeleton" style="height:32px"></div><div class="skeleton"></div></div>
          </section>
        </div>
      </main>
    `;
  }

  try {
    showLoading();
    await app.data.load();
    for (var pageName in app.pages) {
      app.nav.register(pageName, app.pages[pageName].render.bind(app.pages[pageName]));
    }
    app.nav.start();
  } catch (error) {
    console.error(error);
    document.getElementById("app").innerHTML = `
      <main class="content">
        <section class="panel">
          <h1 class="section-title">RetailOps could not start</h1>
          <p class="section-copy">${app.help.escapeHtml(error.message)}</p>
        </section>
      </main>
    `;
  }
}

startApp();


