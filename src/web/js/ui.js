// Utilidades de interfaz compartidas por el panel. Todo se construye con la API
// del DOM (textContent, createElement): nada del servidor se inserta como HTML.
(() => {
    const P = (window.Purrfit = window.Purrfit || {});

    // Bus de eventos interno entre módulos (p. ej. "guild-change").
    P.bus = new EventTarget();

    const $ = (s, r = document) => r.querySelector(s);
    const $$ = (s, r = document) => [...r.querySelectorAll(s)];

    /**
     * Crea un nodo. props: class, text, attrs {}, data {}, on {evento: fn}.
     * No existe ninguna vía para escribir HTML ni atributos style.
     */
    function h(tag, props = {}, ...children) {
        const node = document.createElement(tag);
        for (const [key, value] of Object.entries(props)) {
            if (value === undefined || value === null || value === false)
                continue;
            if (key === "class") node.className = value;
            else if (key === "text") node.textContent = value;
            else if (key === "attrs") {
                for (const [a, v] of Object.entries(value)) {
                    if (a.toLowerCase() === "style" || /^on/i.test(a)) continue;
                    if (v !== undefined && v !== null && v !== false)
                        node.setAttribute(a, v === true ? "" : String(v));
                }
            } else if (key === "data") Object.assign(node.dataset, value);
            else if (key === "on") {
                for (const [ev, fn] of Object.entries(value))
                    node.addEventListener(ev, fn);
            }
        }
        for (const child of children.flat()) {
            if (child === undefined || child === null || child === false)
                continue;
            node.append(child);
        }
        return node;
    }

    // Región aria-live visualmente oculta para anuncios breves ("Copiado").
    function announce(text) {
        const region = $("#sr-live");
        if (!region) return;
        region.textContent = "";
        setTimeout(() => (region.textContent = text), 40);
    }

    let toastTimer = 0;
    function toast(text, ok = true) {
        const el = $("#toast");
        if (!el) return;
        el.textContent = text;
        el.classList.toggle("ok", ok);
        el.hidden = false;
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => (el.hidden = true), 6000);
    }

    const nf = (min, max) =>
        new Intl.NumberFormat("es", {
            minimumFractionDigits: min,
            maximumFractionDigits: max,
        });
    const intFmt = nf(0, 0);

    // Decimales según la magnitud: precios de 0,1 a más de 1000 (2 a 6 decimales).
    function decimalsFor(value) {
        const v = Math.abs(Number(value));
        if (!Number.isFinite(v)) return 2;
        if (v >= 100) return 2;
        if (v >= 10) return 3;
        if (v >= 1) return 4;
        if (v >= 0.1) return 5;
        return 6;
    }
    function price(value, decimals) {
        if (!Number.isFinite(Number(value))) return "—";
        const d = decimals ?? decimalsFor(value);
        return nf(d, d).format(Number(value));
    }
    function percent(value) {
        if (!Number.isFinite(Number(value))) return "—";
        const n = Number(value);
        const sign = n > 0 ? "+" : n < 0 ? "−" : "";
        return `${sign}${nf(2, 2).format(Math.abs(n))}%`;
    }
    const trend = (value) => (value > 0 ? "up" : value < 0 ? "down" : "flat");
    const arrow = (value) => (value > 0 ? "▲" : value < 0 ? "▼" : "■");

    function fmtDate(iso) {
        const d = iso ? new Date(iso) : null;
        return d && !Number.isNaN(d.getTime())
            ? d.toLocaleString("es", {
                  dateStyle: "medium",
                  timeStyle: "short",
              })
            : "—";
    }
    function fmtDuration(seconds) {
        const d = Math.floor(seconds / 86400);
        const hh = Math.floor((seconds % 86400) / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        if (d) return `${d} d ${hh} h`;
        if (hh) return `${hh} h ${m} min`;
        return `${m} min`;
    }
    function fmtAgo(seconds) {
        if (seconds < 90) return `hace ${Math.max(0, Math.round(seconds))} s`;
        return `hace ${fmtDuration(seconds)}`;
    }

    const norm = (s) =>
        String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

    /**
     * Navegación con flechas para tablist / radiogroup (tabindex itinerante).
     * onMove(item) se llama al mover el foco; el llamador decide si activa.
     */
    function roving(
        container,
        itemSelector,
        onMove,
        orientation = "horizontal",
    ) {
        container.addEventListener("keydown", (e) => {
            const items = $$(itemSelector, container).filter(
                (i) => !i.disabled,
            );
            const at = items.indexOf(document.activeElement);
            if (at < 0) return;
            const next =
                orientation === "vertical" ? "ArrowDown" : "ArrowRight";
            const prev = orientation === "vertical" ? "ArrowUp" : "ArrowLeft";
            let to = -1;
            if (e.key === next) to = (at + 1) % items.length;
            else if (e.key === prev)
                to = (at - 1 + items.length) % items.length;
            else if (e.key === "Home") to = 0;
            else if (e.key === "End") to = items.length - 1;
            if (to < 0) return;
            e.preventDefault();
            items[to].focus();
            onMove(items[to]);
        });
    }

    // Esqueleto reutilizable (barras con brillo; la animación respeta reduced-motion).
    const skeleton = (n = 3, cls = "") =>
        h(
            "div",
            {
                class: `skeleton-stack ${cls}`.trim(),
                attrs: { "aria-hidden": "true" },
            },
            Array.from({ length: n }, () => h("span", { class: "skeleton" })),
        );

    P.ui = {
        $,
        $$,
        h,
        announce,
        toast,
        skeleton,
        roving,
        norm,
        fmt: {
            int: (v) =>
                Number.isFinite(Number(v)) ? intFmt.format(Number(v)) : "—",
            price,
            percent,
            decimalsFor,
            trend,
            arrow,
            date: fmtDate,
            duration: fmtDuration,
            ago: fmtAgo,
        },
    };
})();
