(function () {
  "use strict";

  const TAG = "com-umut-kpicard";

  // No fake sample text/numbers here on purpose — an unconfigured widget
  // should render as an obviously-empty card, not a placeholder that looks
  // like real data. Only visual/styling defaults get real values.
  const DEFAULTS = {
    title: "",
    titleColor: "#8B95A1",
    subtitle: "",
    value: "",
    valueColor: "#FFFFFF",
    badgeText: "",
    badgeColor: "#E8985E",
    accentColor: "#4A90D9",
    accentColorEnd: "",
    backgroundColor: "#15181A",
    cornerRadius: 16
  };

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
        background: #15181A;
        border: 1px solid rgba(255, 255, 255, 0.06);
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
        color: #8B95A1;
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
        color: #FFFFFF;
        line-height: 1.15;
        margin-top: 2px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
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
        background: rgba(255, 255, 255, 0.06);
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
      <div class="value" part="value"></div>
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

      this._props = Object.assign({}, DEFAULTS);

      this._els = {
        card: this._shadowRoot.querySelector(".card"),
        accent: this._shadowRoot.querySelector(".accent"),
        title: this._shadowRoot.querySelector(".title"),
        subtitle: this._shadowRoot.querySelector(".subtitle"),
        value: this._shadowRoot.querySelector(".value"),
        badge: this._shadowRoot.querySelector(".badge"),
        badgeText: this._shadowRoot.querySelector(".badge-text")
      };
    }

    connectedCallback() {
      this._render();
    }

    // --- SAC lifecycle hooks -------------------------------------------
    // Some SAC runtime versions assign properties directly (see setters
    // below); others push a changed-properties map through this hook.
    // Handling both keeps the widget working across versions.
    // "myDataBinding" arrives here too (when a measure is bound in the
    // Builder Panel) but has its own {data, metadata} shape, so it's
    // pulled out and handled separately from the flat properties.
    onCustomWidgetBeforeUpdate(changedProps) {
      const rest = Object.assign({}, changedProps);
      delete rest.myDataBinding;
      this._props = Object.assign({}, this._props, rest);
    }

    onCustomWidgetAfterUpdate(changedProps) {
      const rest = Object.assign({}, changedProps);
      delete rest.myDataBinding;
      this._props = Object.assign({}, this._props, rest);
      // Always re-read the data binding here, regardless of whether it shows
      // up as a key in changedProps: per the lifecycle order, any property
      // setter (including SAC's own for the data binding) runs before this
      // hook, so `this.myDataBinding` is guaranteed current by now. Relying
      // only on changedProps or only on our own setter firing turned out to
      // be fragile across SAC versions.
      this._applyDataBinding(this.myDataBinding);
      this._render();
    }

    // Reads the bound measure's value out of the data binding payload and
    // uses it as the card's "value" text — this always wins over the manual
    // "value" property once a measure is bound. Also auto-fills the title
    // from the measure's own display name when the user hasn't typed one.
    // Payload shape per the official SAC Custom Widget Developer Guide:
    // { data: [ { measures_0: {raw, formatted, unit}, dimensions_0: {...} } ],
    //   metadata: { mainStructureMembers: { measures_0: {id, label} }, ... } }
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
          // Single row (no dimension bound, or one member selected): show
          // the model's own formatted string when available.
          const cell = rows[0][firstKey];
          if (cell && typeof cell.formatted === "string" && cell.formatted.length) {
            this._props.value = cell.formatted;
          } else if (cell && typeof cell.raw === "number") {
            this._props.value = cell.raw.toLocaleString("de-DE");
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
            this._props.value = sum.toLocaleString("de-DE");
          }
        }
      }

      // Auto-title from the bound measure's own name, only if the user
      // hasn't already typed a title in the Builder Panel.
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

    // --- Property accessors ---------------------------------------------
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

      this._els.value.textContent = p.value || "";
      this._els.value.style.color = p.valueColor || DEFAULTS.valueColor;

      if (p.badgeText) {
        this._els.badge.hidden = false;
        this._els.badgeText.textContent = p.badgeText;
        this._els.badge.style.color = p.badgeColor || DEFAULTS.badgeColor;
      } else {
        this._els.badge.hidden = true;
      }
    }
  }

  // Define a getter/setter pair for every property so SAC can assign
  // `widgetInstance.propertyName = value` directly from the Builder Panel.
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

  // Some SAC versions assign the data binding directly as a property
  // instead of (or in addition to) routing it through
  // onCustomWidgetAfterUpdate — cover both paths.
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
