(function () {
  "use strict";

  const TAG = "com-umut-kpicard";

  // No fake sample text/numbers here on purpose — an unconfigured widget
  // should render as an obviously-empty card, not a placeholder that looks
  // like real data. Only visual/styling defaults get real values.
  const DEFAULTS = {
    title: "",
    titleColor: "#667085",
    subtitle: "",
    value: "",
    valueColor: "#1A1A1A",
    badgeText: "",
    badgeColor: "#E8985E",
    accentColor: "#4A90D9",
    accentColorEnd: "",
    backgroundColor: "#FFFFFF",
    cornerRadius: 16
  };

  // Numbers under 100'000 are shown exactly as-is (e.g. "9.338", "842"),
  // matching plain "count" style KPI tiles. Larger numbers are abbreviated
  // with a small unit suffix (k / Mio. / Mrd.) so they always fit the card,
  // the same way native SAC Numeric Point tiles show "147,37" + "k".
  function formatMeasureValue(raw) {
    if (typeof raw !== "number" || !Number.isFinite(raw)) {
      return { text: String(raw), unit: "" };
    }
    const abs = Math.abs(raw);
    if (abs < 100000) {
      return {
        text: raw.toLocaleString("de-DE", { maximumFractionDigits: 0 }),
        unit: ""
      };
    }
    let divisor = 1e3;
    let unit = "k";
    if (abs >= 1e9) {
      divisor = 1e9;
      unit = "Mrd.";
    } else if (abs >= 1e6) {
      divisor = 1e6;
      unit = "Mio.";
    }
    return {
      text: (raw / divisor).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      unit: unit
    };
  }

  // Decide how to render one data-bound cell. SAC's own "formatted" string
  // already carries special semantics we can't safely reconstruct from
  // "raw" alone — percentages ("42,0%"), currencies, units, locale-specific
  // decimal rules — so it's trusted whenever it's short enough to fit the
  // card. Only when it's missing or too long (large unscaled numbers, e.g.
  // amounts in the hundred-thousands) do we fall back to computing our own
  // compact k / Mio. / Mrd. abbreviation from the raw number.
  function formatCell(cell) {
    if (!cell) {
      return null;
    }
    if (typeof cell.formatted === "string" && cell.formatted.length && cell.formatted.length <= 12) {
      return { text: cell.formatted, unit: "" };
    }
    if (typeof cell.raw === "number") {
      return formatMeasureValue(cell.raw);
    }
    if (typeof cell.formatted === "string" && cell.formatted.length) {
      return { text: cell.formatted, unit: "" };
    }
    return null;
  }

  const template = document.createElement("template");
  template.innerHTML = `
    <style>
      :host {
        display: block;
        width: 100%;
        height: 100%;
        box-sizing: border-box;
        font-family: "72", "Segoe UI", Arial, sans-serif;
      }
      .card {
        position: relative;
        box-sizing: border-box;
        width: 100%;
        height: 100%;
        overflow: hidden;
        background: #FFFFFF;
        border: 1px solid rgba(0, 0, 0, 0.08);
        border-radius: 16px;
        padding: 18px 20px 20px 20px;
        display: flex;
        flex-direction: column;
        justify-content: center;
        gap: 6px;
      }
      .accent {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 4px;
        background: #4A90D9;
      }
      .title {
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: #667085;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .subtitle {
        font-size: 12px;
        color: #6B7280;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .value {
        font-size: 34px;
        font-weight: 700;
        color: #1A1A1A;
        line-height: 1.15;
        margin-top: 2px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .value-unit {
        font-size: 15px;
        font-weight: 600;
        color: #8B95A1;
        margin-left: 4px;
      }
      .badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        margin-top: 8px;
        padding: 4px 10px;
        width: fit-content;
        max-width: 100%;
        border-radius: 999px;
        background: rgba(0, 0, 0, 0.05);
        font-size: 11px;
        font-weight: 600;
        color: #E8985E;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .dot {
        flex: 0 0 auto;
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: currentColor;
      }
      .badge[hidden] {
        display: none;
      }
    </style>
    <div class="card" part="card">
      <div class="accent" part="accent"></div>
      <div class="title" part="title"></div>
      <div class="subtitle" part="subtitle"></div>
      <div class="value" part="value"><span class="value-number"></span><span class="value-unit"></span></div>
      <div class="badge" part="badge" hidden>
        <span class="dot"></span>
        <span class="badge-text"></span>
      </div>
    </div>
  `;

  class KpiCard extends HTMLElement {
    constructor() {
      super();
      this._shadowRoot = this.attachShadow({ mode: "open" });
      this._shadowRoot.appendChild(template.content.cloneNode(true));

      this._props = Object.assign({}, DEFAULTS, { valueUnit: "" });

      this._els = {
        card: this._shadowRoot.querySelector(".card"),
        accent: this._shadowRoot.querySelector(".accent"),
        title: this._shadowRoot.querySelector(".title"),
        subtitle: this._shadowRoot.querySelector(".subtitle"),
        valueNumber: this._shadowRoot.querySelector(".value-number"),
        valueUnit: this._shadowRoot.querySelector(".value-unit"),
        badge: this._shadowRoot.querySelector(".badge"),
        badgeText: this._shadowRoot.querySelector(".badge-text")
      };
    }

    connectedCallback() {
      this._render();
    }

    onCustomWidgetBeforeUpdate(changedProps) {
      const rest = Object.assign({}, changedProps);
      delete rest.myDataBinding;
      this._props = Object.assign({}, this._props, rest);
    }

    onCustomWidgetAfterUpdate(changedProps) {
      const rest = Object.assign({}, changedProps);
      delete rest.myDataBinding;
      this._props = Object.assign({}, this._props, rest);
      this._applyDataBinding(this.myDataBinding);
      this._render();
    }

    _applyDataBinding(dataBinding) {
      if (!dataBinding) {
        return;
      }
      const rows = Array.isArray(dataBinding.data) ? dataBinding.data : [];
      if (!rows.length) {
        return;
      }

      const findMeasureKey = (row) => {
        for (const key in row) {
          if (Object.prototype.hasOwnProperty.call(row, key) && key.indexOf("measures_") === 0) {
            return key;
          }
        }
        return null;
      };

      const firstKey = findMeasureKey(rows[0]);
      if (firstKey) {
        if (rows.length === 1) {
          // Single row (no dimension bound, or one member selected).
          const cell = rows[0][firstKey];
          const formatted = formatCell(cell);
          if (formatted) {
            this._props.value = formatted.text;
            this._props.valueUnit = formatted.unit;
          }
        } else {
          // Multiple rows (a dimension is bound and returned several
          // members): sum the raw values into one total for the card.
          let sum = 0;
          let any = false;
          rows.forEach((row) => {
            const key = findMeasureKey(row);
            const cell = key && row[key];
            if (cell && typeof cell.raw === "number") {
              sum += cell.raw;
              any = true;
            }
          });
          if (any) {
            const formatted = formatMeasureValue(sum);
            this._props.value = formatted.text;
            this._props.valueUnit = formatted.unit;
          }
        }
      }

      if (!this._props.title) {
        const members = dataBinding.metadata && dataBinding.metadata.mainStructureMembers;
        if (members) {
          const memberKey = Object.keys(members)[0];
          const label = memberKey && members[memberKey] && members[memberKey].label;
          if (label) {
            this._props.title = label;
          }
        }
      }
    }

    onCustomWidgetResize() {
      this._render();
    }

    onCustomWidgetDestroy() {
      // nothing to clean up
    }

    static get observedProperties() {
      return Object.keys(DEFAULTS);
    }

    _render() {
      const p = this._props;
      const radius = Number.isFinite(p.cornerRadius) ? p.cornerRadius : parseInt(p.cornerRadius, 10) || DEFAULTS.cornerRadius;

      this._els.card.style.borderRadius = radius + "px";
      this._els.card.style.background = p.backgroundColor || DEFAULTS.backgroundColor;

      this._els.accent.style.borderTopLeftRadius = radius + "px";
      this._els.accent.style.borderTopRightRadius = radius + "px";
      const start = p.accentColor || DEFAULTS.accentColor;
      const end = p.accentColorEnd;
      this._els.accent.style.background = end ? `linear-gradient(90deg, ${start}, ${end})` : start;

      this._els.title.textContent = p.title || "";
      this._els.title.style.color = p.titleColor || DEFAULTS.titleColor;

      this._els.subtitle.textContent = p.subtitle || "";
      this._els.subtitle.hidden = !p.subtitle;

      this._els.valueNumber.textContent = p.value || "";
      this._els.valueNumber.style.color = p.valueColor || DEFAULTS.valueColor;
      this._els.valueUnit.textContent = p.valueUnit || "";

      if (p.badgeText) {
        this._els.badge.hidden = false;
        this._els.badgeText.textContent = p.badgeText;
        this._els.badge.style.color = p.badgeColor || DEFAULTS.badgeColor;
      } else {
        this._els.badge.hidden = true;
      }
    }
  }

  DEFAULTS && Object.keys(DEFAULTS).forEach((name) => {
    Object.defineProperty(KpiCard.prototype, name, {
      get() {
        return this._props[name];
      },
      set(v) {
        this._props[name] = v === undefined || v === null ? DEFAULTS[name] : v;
        this._render();
      },
      configurable: true,
      enumerable: true
    });
  });

  Object.defineProperty(KpiCard.prototype, "myDataBinding", {
    get() {
      return this._dataBinding;
    },
    set(v) {
      this._dataBinding = v;
      this._applyDataBinding(v);
      this._render();
    },
    configurable: true,
    enumerable: true
  });

  if (!customElements.get(TAG)) {
    customElements.define(TAG, KpiCard);
  }
})();
