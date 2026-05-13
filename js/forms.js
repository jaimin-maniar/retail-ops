/* Simple dynamic form builder used by modal forms. */

// simple form maker
{
function createField(field, values) {
    const wrapper = document.createElement("label");
    wrapper.className = field.type === "checkbox" ? "checkbox-line" : "form-field";
    const id = `field-${field.name}-${Math.random().toString(16).slice(2)}`;
    const value = values[field.name] ?? field.defaultValue ?? "";

    if (field.type === "checkbox") {
      wrapper.innerHTML = `
        <input id="${id}" name="${field.name}" type="checkbox" ${value ? "checked" : ""}>
        <span>${app.help.escapeHtml(field.label)}</span>
      `;
      return wrapper;
    }

    const label = document.createElement("span");
    label.textContent = field.label;
    wrapper.appendChild(label);

    let control;
    if (field.type === "select") {
      control = document.createElement("select");
      control.className = "select";
      (field.options || []).forEach((option) => {
        const opt = document.createElement("option");
        opt.value = option.value;
        opt.textContent = option.label;
        if (String(option.value) === String(value)) {
          opt.selected = true;
        }
        control.appendChild(opt);
      });
    } else if (field.type === "textarea") {
      control = document.createElement("textarea");
      control.className = "textarea";
      control.value = value;
    } else {
      control = document.createElement("input");
      control.className = "input";
      control.type = field.type || "text";
      control.value = value;
      if (field.min !== undefined) {
        control.min = field.min;
      }
      if (field.step !== undefined) {
        control.step = field.step;
      }
    }

    control.id = id;
    control.name = field.name;
    if (field.required) {
      control.required = true;
    }
    if (field.placeholder) {
      control.placeholder = field.placeholder;
    }

    wrapper.appendChild(control);

    if (field.help) {
      const help = document.createElement("span");
      help.className = "field-help";
      help.textContent = field.help;
      wrapper.appendChild(help);
    }

    return wrapper;
  }

  app.forms = {
    create(fields, values, onSubmit, options) {
      const config = options || {};
      const form = document.createElement("form");
      form.className = "app-form";
      form.innerHTML = `<div class="form-grid"></div><div class="form-actions"></div>`;
      const grid = form.querySelector(".form-grid");
      const actions = form.querySelector(".form-actions");

      fields.forEach((field) => {
        grid.appendChild(createField(field, values || {}));
      });

      const cancel = document.createElement("button");
      cancel.type = "button";
      cancel.className = "btn btn-secondary";
      cancel.textContent = config.cancelLabel || "Cancel";
      cancel.addEventListener("click", () => {
        if (config.onCancel) {
          config.onCancel();
        } else {
          const close = document.querySelector("[data-modal-close]");
          if (close) {
            close.click();
          }
        }
      });

      const submit = document.createElement("button");
      submit.type = "submit";
      submit.className = "btn btn-primary";
      submit.textContent = config.submitLabel || "Save";

      actions.append(cancel, submit);

      form.addEventListener("submit", (event) => {
        event.preventDefault();
        const data = {};
        fields.forEach((field) => {
          const control = form.elements[field.name];
          if (!control) {
            return;
          }
          if (field.type === "checkbox") {
            data[field.name] = control.checked;
          } else if (field.type === "number") {
            data[field.name] = Number(control.value);
          } else {
            data[field.name] = control.value;
          }
        });

        try {
          onSubmit(data);
        } catch (error) {
          app.toast.error(error.message);
        }
      });

      return form;
    }
  };
}



