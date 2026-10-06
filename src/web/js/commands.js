// Pestaña "Comandos": manifiesto de GET /api/commands agrupado por categoría,
// con búsqueda y el prefijo del servidor seleccionado (o el de por defecto).
(() => {
    const P = (window.Purrfit = window.Purrfit || {});
    const { $, h, toast, announce, skeleton, norm } = P.ui;

    let manifest = null;
    let loading = false;
    let started = false;
    let query = "";
    // Cada <code> de uso se reescribe cuando cambia el prefijo, sin volver a pedir nada.
    let bindings = [];
    let sections = [];

    const prefix = () => P.servers.getPrefix() ?? manifest?.defaultPrefix ?? "";

    function usageText(usage) {
        return `${prefix()}${usage}`;
    }

    // What is shown: a zero-width space after "|" lets a long option list wrap
    // between options instead of in the middle of a word. Copying uses the
    // plain text (usageText), never this one.
    function usageDisplay(usage) {
        return usageText(usage).replace(/\|/g, "|\u200b");
    }

    // The manifest comes from the bot in English; the panel speaks Spanish.
    const CATEGORY_TITLES = {
        economy: "💰 Economía",
        crypto: "📈 Cripto",
        games: "🎲 Juegos",
        admin: "🛠️ Administración",
        utility: "ℹ️ Utilidades",
    };

    async function copy(text, button) {
        try {
            await navigator.clipboard.writeText(text);
            const label = button.textContent;
            button.textContent = "Copiado";
            button.classList.add("done");
            announce(`Copiado: ${text}`);
            setTimeout(() => {
                button.textContent = label;
                button.classList.remove("done");
            }, 1600);
        } catch {
            toast(
                "No se pudo copiar. Selecciona el texto y cópialo a mano.",
                false,
            );
        }
    }

    function usageLine(usage, label) {
        const code = h("code", { class: "usage", text: usageDisplay(usage) });
        bindings.push({ code, usage });
        const btn = h("button", {
            class: "copy-btn",
            text: "Copiar",
            attrs: { type: "button", "aria-label": `Copiar ${label}` },
        });
        btn.addEventListener("click", () => copy(usageText(usage), btn));
        return h("div", { class: "usage-line" }, code, btn);
    }

    function aliasChips(aliases) {
        if (!aliases || !aliases.length) return null;
        return h(
            "ul",
            { class: "alias-list", attrs: { "aria-label": "Alias" } },
            aliases.map((a) => {
                const code = h("code", { text: `${prefix()}${a}` });
                bindings.push({ code, usage: a });
                return h("li", { class: "chip" }, code);
            }),
        );
    }

    function searchText(cmd) {
        return norm(
            [
                cmd.name,
                ...(cmd.aliases || []),
                cmd.description,
                cmd.usage,
                ...(cmd.subcommands || []).flatMap((s) => [
                    s.name,
                    ...(s.aliases || []),
                    s.description,
                ]),
            ].join(" "),
        );
    }

    function commandCard(cmd) {
        const admin = cmd.permission === "admin";
        const subs = cmd.subcommands || [];
        const card = h(
            "article",
            { class: "cmd-card" },
            h(
                "header",
                { class: "cmd-head" },
                h("h4", { class: "cmd-name", text: cmd.name }),
                admin &&
                    h("span", {
                        class: "chip warn",
                        text: "solo admins",
                    }),
            ),
            usageLine(cmd.usage, `uso de ${cmd.name}`),
            h("p", { class: "cmd-desc", text: cmd.description }),
            aliasChips(cmd.aliases),
            subs.length > 0 &&
                h(
                    "ul",
                    {
                        class: "sub-list",
                        attrs: { "aria-label": `Subcomandos de ${cmd.name}` },
                    },
                    subs.map((sub) =>
                        h(
                            "li",
                            { class: "sub-item" },
                            usageLine(
                                sub.usage,
                                `uso de ${cmd.name} ${sub.name}`,
                            ),
                            h("p", {
                                class: "cmd-desc",
                                text: sub.description,
                            }),
                            aliasChips(sub.aliases),
                        ),
                    ),
                ),
        );
        card.dataset.search = searchText(cmd);
        return card;
    }

    function render() {
        bindings = [];
        sections = [];
        const body = $("#cmd-body");
        const blocks = manifest.categories.map((cat) => {
            const cards = cat.commands.map(commandCard);
            const heading = h("h3", {
                text: CATEGORY_TITLES[cat.id] ?? cat.title,
                attrs: { id: `cat-${cat.id}` },
            });
            const count = h("span", {
                class: "count",
                text: String(cards.length),
            });
            heading.append(count);
            const section = h(
                "section",
                {
                    class: "cmd-group",
                    attrs: { "aria-labelledby": `cat-${cat.id}` },
                },
                heading,
                h("div", { class: "cmd-grid" }, cards),
            );
            sections.push({ section, cards });
            return section;
        });

        const slash = manifest.slash || [];
        const slashBlock =
            slash.length > 0 &&
            h(
                "section",
                {
                    class: "cmd-group slash",
                    attrs: { "aria-labelledby": "cat-slash" },
                },
                h("h3", {
                    text: "Comandos de barra (/)",
                    attrs: { id: "cat-slash" },
                }),
                h("p", {
                    class: "lead",
                    text: "Solo estos usan la barra de Discord; el resto funciona con el prefijo del servidor.",
                }),
                h(
                    "ul",
                    { class: "slash-list" },
                    slash.map((s) =>
                        h(
                            "li",
                            { class: "cmd-card" },
                            h("code", { class: "usage", text: `/${s.name}` }),
                            h("p", { class: "cmd-desc", text: s.description }),
                        ),
                    ),
                ),
            );
        const empty = h("p", {
            class: "state-block",
            text: "Ningún comando coincide con tu búsqueda.",
            attrs: { id: "cmd-empty", hidden: true },
        });
        body.replaceChildren(...blocks, empty, slashBlock);
        applyFilter();
    }

    function applyFilter() {
        if (!manifest) return;
        let q = norm(query.trim());
        const p = norm(prefix());
        if (p && q.startsWith(p)) q = q.slice(p.length); // permite escribir "$>work"
        let shown = 0;
        for (const { section, cards } of sections) {
            let any = false;
            for (const card of cards) {
                const match = !q || card.dataset.search.includes(q);
                card.hidden = !match;
                if (match) any = true;
            }
            section.hidden = !any;
            if (any) shown += 1;
        }
        const empty = $("#cmd-empty");
        if (empty) empty.hidden = shown > 0;
        const slash = $(".cmd-group.slash");
        if (slash)
            slash.hidden =
                !!q &&
                !norm("slash barra / help dashboard support").includes(q);
    }

    function refreshPrefix() {
        for (const { code, usage } of bindings)
            code.textContent = usageDisplay(usage);
        const pill = $("#cmd-prefix");
        if (pill) pill.textContent = prefix();
        applyFilter();
    }

    async function load() {
        if (loading) return;
        loading = true;
        const body = $("#cmd-body");
        body.setAttribute("aria-busy", "true");
        body.replaceChildren(skeleton(6, "cmds"));
        try {
            const data = await P.api.commands();
            if (!data || !Array.isArray(data.categories))
                throw new Error("bad_manifest");
            manifest = data;
            render();
            refreshPrefix();
        } catch (e) {
            manifest = null;
            body.replaceChildren(
                h(
                    "div",
                    { class: "state-block error", attrs: { role: "alert" } },
                    h("p", {
                        text:
                            e.status === 503
                                ? "La lista de comandos todavía no está disponible. Inténtalo en unos minutos."
                                : P.api.describe(
                                      e,
                                      "No se pudo cargar la lista de comandos.",
                                  ),
                    }),
                    h("button", {
                        class: "btn btn-small btn-ghost",
                        text: "Reintentar",
                        attrs: { type: "button" },
                        on: { click: load },
                    }),
                ),
            );
        } finally {
            loading = false;
            body.removeAttribute("aria-busy");
        }
    }

    // Selector de servidor: solo los que tienen a Purrfit.
    async function fillServers() {
        const select = $("#cmd-guild");
        try {
            const guilds = (await P.servers.ensureGuilds()).filter(
                (g) => g.botPresent,
            );
            const current = P.servers.selectedId || "";
            select.replaceChildren(
                h("option", {
                    text: "Prefijo por defecto",
                    attrs: { value: "" },
                }),
                ...guilds.map((g) =>
                    h("option", {
                        text: g.name,
                        attrs: { value: g.id, selected: g.id === current },
                    }),
                ),
            );
            select.disabled = false;
        } catch {
            select.disabled = true;
        }
    }

    function init() {
        $("#cmd-search").addEventListener("input", (e) => {
            query = e.target.value;
            applyFilter();
        });
        $("#cmd-guild").addEventListener("change", (e) => {
            // Sin servidor se vuelve al prefijo por defecto del manifiesto.
            P.servers.select(e.target.value || null);
        });
        P.bus.addEventListener("guild-change", (e) => {
            const select = $("#cmd-guild");
            if (select) select.value = e.detail.id ?? "";
            refreshPrefix();
        });
    }

    P.tabs.register("comandos", {
        onShow() {
            if (!started) {
                started = true;
                init();
                load();
            }
            fillServers();
        },
    });
})();
