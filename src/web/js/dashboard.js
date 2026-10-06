// Panel: arranque, compuerta legal y pestaña "Cuenta" (estado del bot, cuenta,
// sesiones). Cliente de la API: no decide permisos ni valida nada de seguridad.
// Que un botón esté oculto no es una protección; el servidor vuelve a comprobar todo.
(() => {
    const P = window.Purrfit;
    const { $, h, fmt, toast } = P.ui;
    const api = P.api;

    $("#year").textContent = new Date().getFullYear();

    // Construye <dt>/<dd> con textContent: nada del servidor se inserta como HTML.
    function fill(list, rows) {
        list.replaceChildren(
            ...rows.map(([label, value]) =>
                h(
                    "div",
                    {},
                    h("dt", { text: label }),
                    h("dd", { text: value }),
                ),
            ),
        );
    }

    const LABELS = {
        online: "Despierto",
        degraded: "Despierto, sin conexión a Discord",
        offline: "Muerto",
        unknown: "Desconocido",
    };

    async function loadStatus() {
        try {
            const s = await api.status();
            $("#status-dot").className = `dot ${s.state}`;
            $("#status-label").textContent = LABELS[s.state] || LABELS.unknown;
            $("#status-detail").textContent =
                s.ageSeconds === null
                    ? "Sin latidos recientes"
                    : `Último latido ${fmt.ago(s.ageSeconds)}`;
            fill($("#status-stats"), [
                ["Latencia", s.pingMs === null ? "—" : `${s.pingMs} ms`],
                ["Servidores", s.guilds === null ? "—" : String(s.guilds)],
                ["Último latido", fmt.date(s.lastBeatAt)],
            ]);
        } catch (e) {
            if (e.code === "legal_required") return;
            $("#status-dot").className = "dot unknown";
            $("#status-label").textContent = LABELS.unknown;
            $("#status-detail").textContent = "No se pudo consultar el estado";
        }
    }

    async function loadActivity() {
        try {
            const a = await api.activity();
            fill($("#activity-stats"), [
                ["Tiempo activo", fmt.duration(a.uptimeSeconds)],
                ["Servidores", String(a.guilds)],
                ["Usuarios (aprox.)", String(a.users)],
                ["Latencia", a.pingMs === null ? "—" : `${a.pingMs} ms`],
                ["Versión", a.version || "—"],
                ["Entorno", a.environment || "—"],
                ["Memoria", a.rssMb === null ? "—" : `${a.rssMb} MB`],
                [
                    "Último evento",
                    a.lastEvent
                        ? `${a.lastEvent.kind} · ${fmt.date(a.lastEvent.at)}`
                        : "—",
                ],
            ]);
        } catch {
            fill($("#activity-stats"), [["Actividad", "No disponible"]]);
        }
    }

    function renderAccount(me) {
        const avatar = $("#acc-avatar");
        // Solo se acepta un avatar https; si no, se queda la imagen por defecto.
        try {
            if (new URL(me.avatarUrl).protocol === "https:")
                avatar.src = me.avatarUrl;
        } catch {
            /* se conserva la imagen por defecto */
        }
        $("#acc-name").textContent = me.displayName;
        $("#acc-username").textContent = `@${me.username}`;
        fill($("#account-stats"), [
            ["ID de Discord", me.discordId],
            ["Registrada", fmt.date(me.createdAt)],
            ["Último acceso", fmt.date(me.lastLoginAt)],
            ["Sesiones activas", String(me.activeSessions)],
            ["Rol", me.isAdmin ? "Administrador" : "Usuario"],
        ]);
    }

    let isAdmin = false;
    let statusTimer = 0;
    P.tabs.register("cuenta", {
        onShow() {
            loadStatus();
            if (isAdmin) loadActivity();
            clearInterval(statusTimer);
            statusTimer = setInterval(() => {
                if (document.visibilityState !== "visible") return;
                loadStatus();
                if (isAdmin) loadActivity();
            }, 30_000);
        },
        onHide() {
            clearInterval(statusTimer);
        },
    });

    function showLegalGate(pending) {
        $("#content").hidden = true;
        $("#legal-gate").hidden = false;
        const names = {
            terms: "Términos de Servicio",
            privacy: "Política de Privacidad",
        };
        $("#legal-docs").replaceChildren(
            ...pending.map((doc) =>
                h(
                    "li",
                    {},
                    h("a", {
                        text: names[doc.document] || doc.document,
                        attrs: {
                            href: `/${doc.document}`,
                            target: "_blank",
                            rel: "noopener",
                        },
                    }),
                    ` (versión ${doc.version})`,
                ),
            ),
        );
    }

    async function start() {
        const session = await api.session();
        if (!session.authenticated) {
            location.replace("/login?error=expired");
            return;
        }
        if (session.legal.pending.length) {
            showLegalGate(session.legal.pending);
            return;
        }
        $("#legal-gate").hidden = true;
        $("#content").hidden = false;

        // Las pestañas funcionan aunque falle /api/me.
        P.tabs.init();
        try {
            const me = await api.me();
            isAdmin = me.isAdmin === true;
            renderAccount(me);
            if (isAdmin) $("#actividad").hidden = false;
            if (P.tabs.current === "cuenta" && isAdmin) loadActivity();
        } catch {
            toast("No se pudo cargar tu cuenta.", false);
        }
    }

    $("#legal-check").addEventListener("change", (e) => {
        $("#legal-accept").disabled = !e.target.checked;
    });
    $("#legal-accept").addEventListener("click", async () => {
        try {
            await api.acceptLegal();
            location.reload();
        } catch {
            toast("No se pudo registrar la aceptación.", false);
        }
    });

    $("#logout").addEventListener("click", async () => {
        try {
            await api.logout();
        } catch {
            /* aunque falle la red, salimos a la pantalla de login */
        }
        location.replace("/login?notice=signed_out");
    });

    $("#revoke-others").addEventListener("click", async () => {
        try {
            const r = await api.revokeOthers();
            toast(
                r.revoked
                    ? `Se cerraron ${r.revoked} sesión(es).`
                    : "No había otras sesiones.",
            );
            renderAccount(await api.me());
        } catch {
            toast("No se pudieron cerrar las sesiones.", false);
        }
    });

    $("#delete-confirm").addEventListener("input", (e) => {
        $("#delete-account").disabled = e.target.value !== "DELETE";
    });
    $("#delete-account").addEventListener("click", async () => {
        try {
            await api.deleteAccount($("#delete-confirm").value);
            location.replace("/login?notice=deleted");
        } catch {
            toast("No se pudo eliminar la cuenta.", false);
        }
    });

    start().catch(() => toast("No se pudo cargar el panel.", false));
})();
