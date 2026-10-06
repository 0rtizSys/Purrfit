// Pestaña "Servidores": lista de servidores gestionados y formulario de ajustes.
// Las reglas de validación reflejan las del servidor solo para dar feedback
// inmediato; el servidor las vuelve a aplicar siempre.
(() => {
    const P = (window.Purrfit = window.Purrfit || {});
    const { $, h, fmt, toast, announce, skeleton, norm } = P.ui;

    const LIMITS = { cooldownMax: 2592000, taxMax: 50, interestMax: 5 };
    const UNITS = [
        { id: "s", label: "segundos", mul: 1 },
        { id: "m", label: "minutos", mul: 60 },
        { id: "h", label: "horas", mul: 3600 },
        { id: "d", label: "días", mul: 86400 },
    ];

    const state = {
        guilds: null, // null = sin cargar
        stale: false,
        selectedId: null,
        settings: null,
        filter: "",
    };
    let guildsPromise = null;
    let selectToken = 0;

    // ---------- Validación (espejo de las reglas del servidor) ----------
    const chars = (s) => [...s].length;

    function checkPrefix(raw) {
        const n = chars(raw);
        if (n < 1 || n > 5) return { error: "Usa entre 1 y 5 caracteres." };
        if (/\s/.test(raw)) return { error: "No puede contener espacios." };
        if (/[`\\@#]/.test(raw))
            return {
                error: "No puede contener comilla invertida, \\, @ ni #.",
            };
        return { value: raw };
    }
    function checkSymbol(raw) {
        const n = chars(raw);
        if (n < 1 || n > 2) return { error: "Usa 1 o 2 caracteres." };
        return { value: raw };
    }
    function checkPercent(raw, max) {
        const text = raw.trim().replace(",", ".");
        if (!/^\d+(\.\d{1,2})?$/.test(text))
            return {
                error: `Escribe un número de 0 a ${max} con máximo 2 decimales.`,
            };
        const value = Number(text);
        if (value > max) return { error: `El máximo es ${max} %.` };
        return { value };
    }
    function checkCooldown(raw, mul) {
        const text = raw.trim().replace(",", ".");
        if (!/^\d+(\.\d+)?$/.test(text))
            return { error: "Escribe un número positivo." };
        const exact = Number(text) * mul;
        const seconds = Math.round(exact);
        if (mul === 1 && Math.abs(exact - seconds) > 1e-9)
            return { error: "En segundos usa un número entero." };
        if (seconds < 1) return { error: "El mínimo es 1 segundo." };
        if (seconds > LIMITS.cooldownMax)
            return { error: "El máximo es 30 días." };
        return { value: seconds };
    }

    // Segundos -> la unidad más natural para mostrar.
    function bestUnit(seconds) {
        if (seconds % 86400 === 0) return UNITS[3];
        if (seconds % 3600 === 0) return UNITS[2];
        if (seconds % 60 === 0) return UNITS[1];
        return UNITS[0];
    }
    function humanSeconds(s) {
        const parts = [];
        const d = Math.floor(s / 86400);
        const hh = Math.floor((s % 86400) / 3600);
        const m = Math.floor((s % 3600) / 60);
        const sec = s % 60;
        if (d) parts.push(`${d} d`);
        if (hh) parts.push(`${hh} h`);
        if (m) parts.push(`${m} min`);
        if (sec || !parts.length) parts.push(`${sec} s`);
        return parts.join(" ");
    }

    // ---------- Carga de servidores ----------
    function ensureGuilds(force = false) {
        if (guildsPromise && !force) return guildsPromise;
        guildsPromise = P.api
            .guilds()
            .then((data) => {
                state.guilds = Array.isArray(data.guilds) ? data.guilds : [];
                state.stale = data.stale === true;
                return state.guilds;
            })
            .catch((e) => {
                guildsPromise = null;
                throw e;
            });
        return guildsPromise;
    }

    function emitChange() {
        P.bus.dispatchEvent(
            new CustomEvent("guild-change", {
                detail: {
                    id: state.selectedId,
                    prefix: state.settings ? state.settings.prefix : null,
                },
            }),
        );
    }

    const listBox = () => $("#guild-list-box");
    const formBox = () => $("#guild-form-box");

    function reauthCallout(text) {
        return h(
            "div",
            { class: "callout warn", attrs: { role: "alert" } },
            h("p", { text }),
            h("a", {
                class: "btn btn-small",
                text: "Volver a iniciar sesión para actualizar tus servidores",
                attrs: { href: "/auth/discord" },
            }),
        );
    }

    function errorBlock(text, retry) {
        return h(
            "div",
            { class: "state-block error", attrs: { role: "alert" } },
            h("p", { text }),
            retry &&
                h("button", {
                    class: "btn btn-small btn-ghost",
                    text: "Reintentar",
                    attrs: { type: "button" },
                    on: { click: retry },
                }),
        );
    }

    // ---------- Vista: lista ----------
    function guildIcon(guild) {
        const initial = ([...(guild.name || "?")][0] || "?").toUpperCase();
        const fallback = () =>
            h("span", {
                class: "guild-icon fallback",
                text: initial,
                attrs: { "aria-hidden": "true" },
            });
        let safe = false;
        try {
            safe =
                !!guild.iconUrl && new URL(guild.iconUrl).protocol === "https:";
        } catch {
            safe = false;
        }
        if (!safe) return fallback();
        const img = h("img", {
            class: "guild-icon",
            attrs: {
                src: guild.iconUrl,
                alt: "",
                width: 44,
                height: 44,
                loading: "lazy",
                decoding: "async",
                referrerpolicy: "no-referrer",
            },
        });
        img.addEventListener("error", () => img.replaceWith(fallback()), {
            once: true,
        });
        return img;
    }

    function guildMeta(guild) {
        const members =
            guild.memberCount === null || guild.memberCount === undefined
                ? null
                : `${fmt.int(guild.memberCount)} miembros`;
        return h(
            "span",
            { class: "guild-meta" },
            members && h("span", { text: members }),
            guild.isOwner && h("span", { class: "chip", text: "Propietario" }),
            h("span", {
                class: `chip ${guild.botPresent ? "ok" : "muted"}`,
                text: guild.botPresent ? "Purrfit está aquí" : "Sin Purrfit",
            }),
        );
    }

    function guildItem(guild) {
        const info = h(
            "span",
            { class: "guild-info" },
            h("strong", { class: "guild-name", text: guild.name }),
            guildMeta(guild),
        );
        if (!guild.botPresent) {
            return h(
                "li",
                { class: "guild-card" },
                guildIcon(guild),
                info,
                h("a", {
                    class: "btn btn-small",
                    text: "Invitar a Purrfit",
                    attrs: {
                        href: "/invite",
                        target: "_blank",
                        rel: "noopener noreferrer",
                        "aria-label": `Invitar a Purrfit a ${guild.name}`,
                    },
                }),
            );
        }
        return h(
            "li",
            { class: "guild-card" },
            h(
                "button",
                {
                    class: "guild-select",
                    data: { id: guild.id },
                    attrs: {
                        type: "button",
                        "aria-pressed": String(guild.id === state.selectedId),
                    },
                    on: { click: () => select(guild.id, { focusForm: true }) },
                },
                guildIcon(guild),
                info,
                h("span", {
                    class: "guild-go",
                    text: "Configurar",
                    attrs: { "aria-hidden": "true" },
                }),
            ),
        );
    }

    function visibleGuilds() {
        const q = norm(state.filter.trim());
        return [...state.guilds]
            .filter((g) => !q || norm(g.name).includes(q))
            .sort(
                (a, b) =>
                    Number(b.botPresent) - Number(a.botPresent) ||
                    a.name.localeCompare(b.name, "es"),
            );
    }

    function renderListItems() {
        const ul = $("#guild-list");
        if (!ul) return;
        if (!state.guilds.length) {
            ul.replaceChildren(
                h("li", {
                    class: "empty-note",
                    text: "No encontramos servidores que puedas gestionar. Necesitas el permiso «Gestionar servidor» o ser propietario.",
                }),
            );
            return;
        }
        const items = visibleGuilds();
        ul.replaceChildren(
            ...(items.length
                ? items.map(guildItem)
                : [
                      h("li", {
                          class: "empty-note",
                          text: "Ningún servidor coincide con la búsqueda.",
                      }),
                  ]),
        );
    }

    function renderList() {
        const head = state.stale
            ? [
                  reauthCallout(
                      "Esta lista puede estar desactualizada: Discord no nos dejó refrescarla.",
                  ),
              ]
            : [];
        const bar = h(
            "div",
            { class: "list-bar" },
            state.guilds.length > 6 &&
                h(
                    "label",
                    { class: "search-field" },
                    h("span", { class: "sr-only", text: "Buscar servidor" }),
                    h("input", {
                        attrs: {
                            type: "search",
                            placeholder: "Buscar servidor…",
                            autocomplete: "off",
                            value: state.filter,
                        },
                        on: {
                            input: (e) => {
                                state.filter = e.target.value;
                                renderListItems();
                            },
                        },
                    }),
                ),
            h("button", {
                class: "btn btn-small btn-ghost",
                text: "Actualizar lista",
                attrs: { type: "button" },
                on: { click: () => loadGuilds(true) },
            }),
        );
        listBox().replaceChildren(
            ...head,
            bar,
            h("ul", { class: "guild-list", attrs: { id: "guild-list" } }),
        );
        renderListItems();
    }

    async function loadGuilds(force = false) {
        const box = listBox();
        box.setAttribute("aria-busy", "true");
        if (state.guilds === null || force)
            box.replaceChildren(skeleton(4, "guilds"));
        try {
            await ensureGuilds(force);
            renderList();
            if (force) announce("Lista de servidores actualizada.");
        } catch (e) {
            box.replaceChildren(
                e.code === "reauth_required"
                    ? reauthCallout(
                          "Necesitamos renovar tu sesión de Discord para ver tus servidores.",
                      )
                    : errorBlock(
                          P.api.describe(
                              e,
                              "No se pudieron cargar tus servidores.",
                          ),
                          () => loadGuilds(true),
                      ),
            );
        } finally {
            box.removeAttribute("aria-busy");
        }
    }

    // ---------- Vista: formulario ----------
    function fieldRow({ id, label, hint, control }) {
        const err = h("p", {
            class: "field-error",
            attrs: { id: `${id}-err` },
        });
        control.setAttribute("aria-describedby", `${id}-hint ${id}-err`);
        const root = h(
            "div",
            { class: "form-field" },
            h("label", {
                class: "form-label",
                text: label,
                attrs: { for: id },
            }),
            control,
            h("p", {
                class: "field-hint",
                text: hint,
                attrs: { id: `${id}-hint` },
            }),
            err,
        );
        return {
            root,
            control,
            setError(msg) {
                err.textContent = msg || "";
                if (msg) control.setAttribute("aria-invalid", "true");
                else control.removeAttribute("aria-invalid");
            },
        };
    }

    function renderForm(s) {
        const box = formBox();
        const unit = bestUnit(s.cooldownSeconds);
        const textInput = (id, value, extra = {}) =>
            h("input", {
                attrs: {
                    id,
                    type: "text",
                    value,
                    autocomplete: "off",
                    spellcheck: "false",
                    ...extra,
                },
            });

        const prefix = textInput("f-prefix", s.prefix);
        const symbol = textInput("f-symbol", s.symbol);
        const cdValue = textInput(
            "f-cooldown",
            String(s.cooldownSeconds / unit.mul),
            { inputmode: "decimal" },
        );
        const cdUnit = h(
            "select",
            {
                attrs: {
                    id: "f-cooldown-unit",
                    "aria-label": "Unidad del cooldown",
                },
            },
            UNITS.map((u) =>
                h("option", {
                    text: u.label,
                    attrs: { value: u.id, selected: u.id === unit.id },
                }),
            ),
        );
        const tax = textInput("f-tax", String(s.taxPercent), {
            inputmode: "decimal",
        });
        const interest = textInput("f-interest", String(s.interestPercent), {
            inputmode: "decimal",
        });

        const rows = {
            prefix: fieldRow({
                id: "f-prefix",
                label: "Prefijo de comandos",
                hint: "1 a 5 caracteres, sin espacios ni comilla invertida, \\, @ o #. Ejemplo: $>work",
                control: prefix,
            }),
            symbol: fieldRow({
                id: "f-symbol",
                label: "Símbolo de la moneda",
                hint: "1 o 2 caracteres, por ejemplo $ o €.",
                control: symbol,
            }),
            cooldown: fieldRow({
                id: "f-cooldown",
                label: "Cooldown del trabajo",
                hint: "Tiempo entre dos trabajos de un mismo miembro (de 1 segundo a 30 días).",
                control: cdValue,
            }),
            tax: fieldRow({
                id: "f-tax",
                label: "Impuesto en transferencias (%)",
                hint: "De 0 a 50, máximo 2 decimales. Va a la tesorería.",
                control: tax,
            }),
            interest: fieldRow({
                id: "f-interest",
                label: "Interés bancario diario (%)",
                hint: "De 0 a 5, máximo 2 decimales.",
                control: interest,
            }),
        };

        // El número y su unidad comparten fila; la etiqueta apunta al número.
        const cdPreview = h("p", {
            class: "field-hint preview",
            attrs: { "aria-hidden": "true" },
        });
        const cdRoot = rows.cooldown.root;
        const group = h("div", { class: "input-group" });
        cdValue.replaceWith(group);
        group.append(cdValue, cdUnit);
        cdRoot.append(cdPreview);

        const okMsg = h("p", { class: "form-ok", attrs: { role: "status" } });
        const errMsg = h("p", { class: "form-err", attrs: { role: "alert" } });
        const extra = h("div", { class: "form-extra" });
        const save = h("button", {
            class: "btn",
            text: "Guardar cambios",
            attrs: { type: "submit" },
        });
        const reset = h("button", {
            class: "btn btn-ghost",
            text: "Descartar cambios",
            attrs: { type: "button" },
        });

        const unitOf = () =>
            UNITS.find((u) => u.id === cdUnit.value) || UNITS[0];
        const updatePreview = () => {
            const r = checkCooldown(cdValue.value, unitOf().mul);
            cdPreview.textContent = r.error
                ? ""
                : `Equivale a ${fmt.int(r.value)} s (${humanSeconds(r.value)}).`;
        };
        cdValue.addEventListener("input", updatePreview);
        cdUnit.addEventListener("change", updatePreview);
        updatePreview();

        // Solo se envía lo que cambió.
        function collect() {
            let ok = true;
            const patch = {};
            const take = (key, row, result, current) => {
                row.setError(result.error);
                if (result.error) ok = false;
                else if (result.value !== current) patch[key] = result.value;
            };
            take("prefix", rows.prefix, checkPrefix(prefix.value), s.prefix);
            take("symbol", rows.symbol, checkSymbol(symbol.value), s.symbol);
            take(
                "cooldownSeconds",
                rows.cooldown,
                checkCooldown(cdValue.value, unitOf().mul),
                s.cooldownSeconds,
            );
            take(
                "taxPercent",
                rows.tax,
                checkPercent(tax.value, LIMITS.taxMax),
                Number(s.taxPercent),
            );
            take(
                "interestPercent",
                rows.interest,
                checkPercent(interest.value, LIMITS.interestMax),
                Number(s.interestPercent),
            );
            return { ok, patch };
        }

        const form = h(
            "form",
            {
                class: "settings-form",
                attrs: { novalidate: true, "aria-labelledby": "form-title" },
            },
            h(
                "div",
                { class: "form-grid" },
                rows.prefix.root,
                rows.symbol.root,
                cdRoot,
                rows.tax.root,
                rows.interest.root,
            ),
            h(
                "dl",
                { class: "stats-grid treasury" },
                h(
                    "div",
                    {},
                    h("dt", { text: "Tesorería (solo lectura)" }),
                    h("dd", { text: `${s.symbol} ${fmt.int(s.treasury)}` }),
                ),
            ),
            h("div", { class: "form-actions" }, save, reset),
            okMsg,
            errMsg,
            extra,
            h("p", {
                class: "field-hint note",
                text: "Los cambios se aplican en aproximadamente un minuto.",
            }),
        );

        reset.addEventListener("click", () => {
            renderForm(s);
            announce("Cambios descartados.");
        });

        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            okMsg.textContent = "";
            errMsg.textContent = "";
            extra.replaceChildren();
            const { ok, patch } = collect();
            if (!ok) {
                errMsg.textContent = "Revisa los campos marcados.";
                form.querySelector('[aria-invalid="true"]')?.focus();
                return;
            }
            if (!Object.keys(patch).length) {
                okMsg.textContent = "No hay cambios que guardar.";
                return;
            }
            save.disabled = reset.disabled = true;
            save.textContent = "Guardando…";
            try {
                const next = await P.api.saveGuildSettings(s.guildId, patch);
                if (state.selectedId === s.guildId) {
                    state.settings = next;
                    renderForm(next);
                    const m = $("#guild-form-box .form-ok");
                    if (m)
                        m.textContent =
                            "Guardado. Los cambios se aplican en aproximadamente un minuto.";
                    emitChange();
                }
                toast(
                    "Ajustes guardados. Se aplican en aproximadamente un minuto.",
                );
            } catch (err) {
                save.disabled = reset.disabled = false;
                save.textContent = "Guardar cambios";
                if (err.code === "reauth_required") {
                    errMsg.textContent =
                        "Tu sesión de Discord necesita renovarse para guardar.";
                    extra.append(
                        reauthCallout(
                            "Vuelve a iniciar sesión para poder cambiar los ajustes.",
                        ),
                    );
                } else if (err.code === "guild_not_found") {
                    errMsg.textContent = P.api.describe(err);
                    loadGuilds(true);
                } else if (err.code === "invalid_request") {
                    errMsg.textContent =
                        err.serverMessage || "Algún valor no es válido.";
                } else {
                    errMsg.textContent = P.api.describe(
                        err,
                        "No se pudieron guardar los ajustes.",
                    );
                }
            }
        });

        box.replaceChildren(
            h(
                "div",
                { class: "form-head" },
                h("h3", {
                    text: `Ajustes de ${s.name}`,
                    attrs: { id: "form-title", tabindex: "-1" },
                }),
                h("p", {
                    class: "lead",
                    text: "Configura la economía de este servidor.",
                }),
            ),
            form,
        );
    }

    async function select(id, { focusForm = false } = {}) {
        const token = ++selectToken;
        state.selectedId = id || null;
        state.settings = null;
        emitChange();
        for (const b of document.querySelectorAll(".guild-select"))
            b.setAttribute("aria-pressed", String(b.dataset.id === id));
        const box = formBox();
        if (!id) {
            box.hidden = true;
            box.replaceChildren();
            return;
        }
        box.hidden = false;
        box.setAttribute("aria-busy", "true");
        box.replaceChildren(skeleton(5, "form"));
        try {
            const s = await P.api.guildSettings(id);
            if (token !== selectToken) return;
            state.settings = s;
            renderForm(s);
            emitChange();
            if (focusForm) {
                const title = $("#form-title");
                title?.scrollIntoView({ block: "start", behavior: "smooth" });
                title?.focus({ preventScroll: true });
            }
        } catch (e) {
            if (token !== selectToken) return;
            box.replaceChildren(
                e.code === "reauth_required"
                    ? reauthCallout(
                          "Necesitamos renovar tu sesión de Discord para leer los ajustes.",
                      )
                    : errorBlock(
                          P.api.describe(
                              e,
                              "No se pudieron cargar los ajustes.",
                          ),
                          () => select(id, { focusForm }),
                      ),
            );
        } finally {
            if (token === selectToken) box.removeAttribute("aria-busy");
        }
    }

    P.servers = {
        ensureGuilds,
        select,
        getPrefix: () => (state.settings ? state.settings.prefix : null),
        get selectedId() {
            return state.selectedId;
        },
    };

    let started = false;
    P.tabs.register("servidores", {
        onShow() {
            if (started) return;
            started = true;
            loadGuilds();
        },
    });
})();
