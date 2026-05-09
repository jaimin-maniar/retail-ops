(async function (app) {
  function renderBoot() {
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
    renderBoot();
    await app.store.load();
    app.pageRegistry.registerAll();
    app.router.start();
  } catch (error) {
    console.error(error);
    document.getElementById("app").innerHTML = `
      <main class="content">
        <section class="panel">
          <h1 class="section-title">RetailOps could not start</h1>
          <p class="section-copy">${app.helpers.escapeHtml(error.message)}</p>
        </section>
      </main>
    `;
  }
})(window.RetailOps = window.RetailOps || {});
