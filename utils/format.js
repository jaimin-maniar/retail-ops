(function (app) {
  const format = {
    currency(value) {
      const amount = Number(value || 0);
      return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 2
      }).format(amount);
    },

    number(value) {
      return new Intl.NumberFormat("en-IN").format(Number(value || 0));
    },

    percent(value) {
      return `${Number(value || 0).toFixed(1)}%`;
    },

    date(value) {
      const date = app.helpers.toDate(value);
      if (!date) {
        return "-";
      }
      return new Intl.DateTimeFormat("en-IN", {
        year: "numeric",
        month: "short",
        day: "2-digit"
      }).format(date);
    },

    dateTime(value) {
      const date = app.helpers.toDate(value);
      if (!date) {
        return "-";
      }
      return new Intl.DateTimeFormat("en-IN", {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
      }).format(date);
    },

    isoDateInput(value) {
      const date = app.helpers.toDate(value);
      if (!date) {
        return "";
      }
      const yyyy = date.getFullYear();
      const mm = String(date.getMonth() + 1).padStart(2, "0");
      const dd = String(date.getDate()).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}`;
    }
  };

  app.format = format;
})(window.RetailOps = window.RetailOps || {});
