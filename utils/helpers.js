(function (app) {
  const helpers = {
    clone(value) {
      return JSON.parse(JSON.stringify(value ?? null));
    },

    escapeHtml(value) {
      return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
    },

    normalizeText(value) {
      return String(value ?? "").trim().toLowerCase();
    },

    nowIso() {
      return new Date().toISOString();
    },

    todayDateOnly() {
      const now = new Date();
      return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    },

    toDate(value) {
      if (!value) {
        return null;
      }
      const date = value instanceof Date ? value : new Date(value);
      return Number.isNaN(date.getTime()) ? null : date;
    },

    toDateOnly(value) {
      const date = helpers.toDate(value);
      if (!date) {
        return null;
      }
      return new Date(date.getFullYear(), date.getMonth(), date.getDate());
    },

    isBetweenDateInclusive(value, start, end) {
      const target = helpers.toDateOnly(value);
      const from = helpers.toDateOnly(start);
      const to = helpers.toDateOnly(end);

      if (!target || !from || !to) {
        return false;
      }

      return target >= from && target <= to;
    },

    addDays(value, days) {
      const date = helpers.toDate(value) || new Date();
      const result = new Date(date);
      result.setDate(result.getDate() + Number(days || 0));
      return result;
    },

    sum(items, selector) {
      return (items || []).reduce((total, item) => total + Number(selector(item) || 0), 0);
    },

    avg(items, selector) {
      if (!items || items.length === 0) {
        return 0;
      }
      return helpers.sum(items, selector) / items.length;
    },

    roundMoney(value) {
      return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
    },

    groupBy(items, keySelector) {
      return (items || []).reduce((groups, item) => {
        const key = keySelector(item);
        if (!groups[key]) {
          groups[key] = [];
        }
        groups[key].push(item);
        return groups;
      }, {});
    },

    unique(items) {
      return Array.from(new Set((items || []).filter(Boolean)));
    },

    compareValues(a, b) {
      const left = a ?? "";
      const right = b ?? "";

      if (typeof left === "number" && typeof right === "number") {
        return left - right;
      }

      return String(left).localeCompare(String(right), undefined, {
        numeric: true,
        sensitivity: "base"
      });
    },

    extractNumericSuffix(value, prefix) {
      const text = String(value || "");
      if (!text.toUpperCase().startsWith(prefix.toUpperCase())) {
        return 0;
      }
      const number = Number.parseInt(text.slice(prefix.length), 10);
      return Number.isFinite(number) ? number : 0;
    },

    nextId(items, field, prefix, width) {
      const lastNumber = Math.max(
        0,
        ...(items || []).map((item) => helpers.extractNumericSuffix(item[field], prefix))
      );
      return `${prefix}${String(lastNumber + 1).padStart(width, "0")}`;
    },

    debounce(fn, delay) {
      let timer = 0;
      return (...args) => {
        window.clearTimeout(timer);
        timer = window.setTimeout(() => fn(...args), delay);
      };
    },

    downloadFile(fileName, content, mimeType) {
      const blob = new Blob([content], { type: mimeType || "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    },

    toCsv(rows, columns) {
      const safeCell = (value) => {
        const text = String(value ?? "");
        if (/[",\n]/.test(text)) {
          return `"${text.replaceAll('"', '""')}"`;
        }
        return text;
      };

      const header = columns.map((column) => safeCell(column.label)).join(",");
      const body = rows.map((row) => columns
        .map((column) => safeCell(typeof column.value === "function" ? column.value(row) : row[column.key]))
        .join(","));
      return [header, ...body].join("\n");
    },

    renderBadge(text, tone) {
      const badgeTone = tone || "neutral";
      return `<span class="badge badge-${badgeTone}">${helpers.escapeHtml(text)}</span>`;
    },

    getStockTone(stock, threshold) {
      if (Number(stock) === 0) {
        return "red";
      }
      if (Number(stock) <= Number(threshold)) {
        return "amber";
      }
      return "green";
    }
  };

  app.helpers = helpers;
})(window.RetailOps = window.RetailOps || {});
