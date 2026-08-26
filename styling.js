(function () {
  "use strict";

  const TAG = "com-umut-kpicard-styling";

  // Same property list/order as widget.json's "properties" object.
  const FIELDS = [
    { key: "title", label: "Title (leave empty to use the measure's name)", type: "text" },
    { key: "subtitle", label: "Subtitle", type: "text" },
    { key: "value", label: "Manual value (only used if no measure is bound)", type: "text" },
    { key: "badgeText", label: "Badge text (leave empty to hide the badge)", type: "text" },
    { key: "cornerRadius", label: "Corner radius (px)", type: "number" },
    { key: "titleColor", label: "Title color", type: "color" },
    { key: "valueColor", label: "Value color", type: "color" },
    { key: "badgeColor", label: "Badge color", type: "color" },
    { key: "accentColor", label: "Accent color (start)", type: "color" },
    { key: "accentColorEnd", label: "Accent color (end, optional, hex or empty)", type: "text" },
    { key: "backgroundColor", label: "Background color", type: "color" }
  ];

  const template = document.createElement("template");
  template.innerHTML = `
    <style>
      :host {
        display: block;
        box-sizing: border-box;
        padding: 14px 16px;
        font-family: "72", "Segoe UI", Arial, sans-serif;
        font-size: 12px;
        color: #222;
      }
      form {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .field label {
        display: block;
        font-weight: 600;
        margin-bottom: 4px;
      }
      .field input[type="text"],
      .field input[type="number"] {
        width: 100%;
        box-sizing: border-box;
        padding: 6px 7px;
        border: 1px solid #c7cdd3;
        border-radius: 4px;
        font-size: 12px;
        font-family: inherit;
      }
      .field input[type="color"] {
        width: 52px;
        height: 28px;
        padding: 0;
        border: 1px solid #c7cdd3;
        border-radius: 4px;
        cursor: pointer;
        background: none;
      }
    </style>
    <form id="form">
      ${FIELDS.map(
        (f) => `
        <div class="field">
          <label for="${f.key}">${f.label}</label>
          <input id="${f.key}" type="${f.type}"${f.type === "number" ? ' min="0" max="40"' : ""}>
        </div>
      `
      ).join("")}
      <input type="submit" style="display:none;">
    </form>
  `;

  class KpiCardStyling extends HTMLElement {
    constructor() {
      super();
      this._shadowRoot = this.attachShadow({ mode: "open" });
      this._shadowRoot.appendChild(template.content.cloneNode(true));

      this._inputs = {};
      FIELDS.forEach((f) => {
        const el = this._shadowRoot.getElementById(f.key);
        this._inputs[f.key] = el;
        // Live-update as the user types/picks a color — no need to press Enter.
        el.addEventListener("input", () => this._emit());
        el.addEventListener("change", () => this._emit());
      });

      this._shadowRoot.getElementById("form").addEventListener("submit", (e) => {
        e.preventDefault();
        this._emit();
      });
    }

    // The Styling Panel gets the same lifecycle calls as the main widget
    // (minus onCustomWidgetResize), so this is how SAC hands us the
    // widget's CURRENT property values to pre-fill the form fields.
    onCustomWidgetAfterUpdate(changedProps) {
      Object.keys(changedProps).forEach((key) => {
        const el = this._inputs[key];
        if (!el) {
          return;
        }
        const value = changedProps[key];
        if (document.activeElement === el) {
          // Don't fight the user while they're actively editing this field.
          return;
        }
        el.value = value === undefined || value === null ? "" : value;
      });
    }

    _emit() {
      const properties = {};
      FIELDS.forEach((f) => {
        const el = this._inputs[f.key];
        if (!el) {
          return;
        }
        if (f.type === "number") {
          const n = parseInt(el.value, 10);
          properties[f.key] = Number.isFinite(n) ? n : 0;
        } else {
          properties[f.key] = el.value;
        }
      });
      this.dispatchEvent(
        new CustomEvent("propertiesChanged", {
          detail: { properties: properties }
        })
      );
    }
  }

  if (!customElements.get(TAG)) {
    customElements.define(TAG, KpiCardStyling);
  }
})();
