// Pestañas accesibles (tablist/tab/tabpanel) con enrutado por hash:
// #servidores, #comandos, #mercados, #cuenta. Cada módulo se registra con
// onShow/onHide para cargar datos al entrar y liberar recursos al salir.
(() => {
    const P = (window.Purrfit = window.Purrfit || {});
    const { $, $$ } = P.ui;

    const DEFAULT = "servidores";
    // Enlaces antiguos del panel: ahora viven dentro de "Cuenta".
    const ALIASES = {
        estado: "cuenta",
        actividad: "cuenta",
        peligro: "cuenta",
    };
    const handlers = new Map();
    let list = null;
    let current = null;

    const tabs = () => $$('[role="tab"]', list);
    const idOf = (tab) => tab.dataset.tab;

    function show(id, { focus = false } = {}) {
        if (!tabs().some((t) => idOf(t) === id)) id = DEFAULT;
        if (id !== current) {
            if (current) handlers.get(current)?.onHide?.();
            current = id;
            for (const tab of tabs()) {
                const on = idOf(tab) === id;
                tab.setAttribute("aria-selected", String(on));
                tab.tabIndex = on ? 0 : -1;
                $(`#panel-${idOf(tab)}`).hidden = !on;
            }
            handlers.get(id)?.onShow?.();
        }
        $(`#tab-${id}`).scrollIntoView({ inline: "center", block: "nearest" });
        if (focus) $(`#tab-${id}`).focus();
    }

    function fromHash() {
        const raw = decodeURIComponent(location.hash.slice(1));
        const id = ALIASES[raw] || raw;
        show(id);
        // Los antiguos anclajes (#estado...) se desplazan a su sección.
        if (ALIASES[raw]) $(`#${raw}`)?.scrollIntoView();
    }

    function select(id) {
        if (location.hash === `#${id}`) show(id);
        else location.hash = id; // dispara hashchange
    }

    P.tabs = {
        register(id, hooks) {
            handlers.set(id, hooks);
        },
        select,
        get current() {
            return current;
        },
        init() {
            list = $("#dash-tabs");
            list.addEventListener("click", (e) => {
                const tab = e.target.closest('[role="tab"]');
                if (tab) select(idOf(tab));
            });
            P.ui.roving(list, '[role="tab"]', (tab) => select(idOf(tab)));
            window.addEventListener("hashchange", fromHash);
            fromHash();
        },
    };
})();
