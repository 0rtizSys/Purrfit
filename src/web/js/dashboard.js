// Panel. Cliente de la API: no decide permisos ni valida nada de seguridad.
// Que un botón esté oculto no es una protección; el servidor vuelve a comprobar todo.
(() => {
    const $ = (s) => document.querySelector(s);
    $("#year").textContent = new Date().getFullYear();

    let csrf = null;

    const toast = (text, ok = true) => {
        const el = $("#toast");
        el.textContent = text;
        el.classList.toggle("ok", ok);
        el.hidden = false;
        clearTimeout(toast.t);
        toast.t = setTimeout(() => (el.hidden = true), 5000);
    };

    class ApiError extends Error {
        constructor(status, code) {
            super(code);
            this.status = status;
            this.code = code;
        }
    }

    async function api(path, { method = "GET", body } = {}) {
        const headers = { Accept: "application/json" };
        if (method !== "GET") {
            headers["Content-Type"] = "application/json";
            if (csrf) headers["X-CSRF-Token"] = csrf;
        }
        const res = await fetch(path, {
            method,
            headers,
            credentials: "same-origin",
            cache: "no-store",
            body: body === undefined ? undefined : JSON.stringify(body),
        });
        if (res.status === 401) {
            location.replace("/login?error=expired");
            throw new ApiError(401, "unauthenticated");
        }
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new ApiError(res.status, data.error || "error");
        return data;
    }

    // Construye <dt>/<dd> con textContent: nada del servidor se inserta como HTML.
    function fill(list, rows) {
        list.replaceChildren();
        for (const [label, value] of rows) {
            const div = document.createElement("div");
            const dt = document.createElement("dt");
            const dd = document.createElement("dd");
            dt.textContent = label;
            dd.textContent = value;
            div.append(dt, dd);
            list.append(div);
        }
    }

    const fmtDate = (iso) =>
        iso
            ? new Date(iso).toLocaleString("es", {
                  dateStyle: "medium",
                  timeStyle: "short",
              })
            : "—";

    function fmtDuration(seconds) {
        const d = Math.floor(seconds / 86400);
        const h = Math.floor((seconds % 86400) / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        if (d) return `${d} d ${h} h`;
        if (h) return `${h} h ${m} min`;
        return `${m} min`;
    }

    function fmtAgo(seconds) {
        if (seconds < 90) return `hace ${Math.max(0, Math.round(seconds))} s`;
        return `hace ${fmtDuration(seconds)}`;
    }

    const LABELS = {
        online: "Despierto",
        degraded: "Despierto, sin conexión a Discord",
        offline: "Muerto",
        unknown: "Desconocido",
    };

    async function loadStatus() {
        try {
            const s = await api("/api/status");
            $("#status-dot").className = `dot ${s.state}`;
            $("#status-label").textContent = LABELS[s.state] || LABELS.unknown;
            $("#status-detail").textContent =
                s.ageSeconds === null
                    ? "Sin latidos recientes"
                    : `Último latido ${fmtAgo(s.ageSeconds)}`;
            fill($("#status-stats"), [
                ["Latencia", s.pingMs === null ? "—" : `${s.pingMs} ms`],
                ["Servidores", s.guilds === null ? "—" : String(s.guilds)],
                ["Último latido", fmtDate(s.lastBeatAt)],
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
            const a = await api("/api/activity");
            fill($("#activity-stats"), [
                ["Tiempo activo", fmtDuration(a.uptimeSeconds)],
                ["Servidores", String(a.guilds)],
                ["Usuarios (aprox.)", String(a.users)],
                ["Latencia", a.pingMs === null ? "—" : `${a.pingMs} ms`],
                ["Versión", a.version || "—"],
                ["Entorno", a.environment || "—"],
                ["Memoria", a.rssMb === null ? "—" : `${a.rssMb} MB`],
                [
                    "Último evento",
                    a.lastEvent
                        ? `${a.lastEvent.kind} · ${fmtDate(a.lastEvent.at)}`
                        : "—",
                ],
            ]);
        } catch {
            fill($("#activity-stats"), [["Actividad", "No disponible"]]);
        }
    }

    function renderAccount(me) {
        $("#acc-avatar").src = me.avatarUrl;
        $("#acc-name").textContent = me.displayName;
        $("#acc-username").textContent = `@${me.username}`;
        fill($("#account-stats"), [
            ["ID de Discord", me.discordId],
            ["Registrada", fmtDate(me.createdAt)],
            ["Último acceso", fmtDate(me.lastLoginAt)],
            ["Sesiones activas", String(me.activeSessions)],
            ["Rol", me.isAdmin ? "Administrador" : "Usuario"],
        ]);
    }

    async function start() {
        const session = await fetch("/api/session", {
            credentials: "same-origin",
            cache: "no-store",
        }).then((r) => r.json());
        if (!session.authenticated) {
            location.replace("/login?error=expired");
            return;
        }
        csrf = session.csrfToken;

        if (session.legal.pending.length) {
            showLegalGate(session.legal.pending);
            return;
        }
        $("#legal-gate").hidden = true;
        $("#content").hidden = false;

        const me = await api("/api/me");
        renderAccount(me);
        if (me.isAdmin) {
            $("#actividad").hidden = false;
            $("#nav-activity").hidden = false;
            loadActivity();
        }
        await loadStatus();
        setInterval(() => {
            loadStatus();
            if (me.isAdmin) loadActivity();
        }, 30_000);
    }

    function showLegalGate(pending) {
        $("#content").hidden = true;
        $("#legal-gate").hidden = false;
        const list = $("#legal-docs");
        list.replaceChildren();
        const names = {
            terms: "Términos de Servicio",
            privacy: "Política de Privacidad",
        };
        for (const doc of pending) {
            const li = document.createElement("li");
            const a = document.createElement("a");
            a.href = `/${doc.document}`;
            a.target = "_blank";
            a.rel = "noopener";
            a.textContent = names[doc.document] || doc.document;
            li.append(a, ` (versión ${doc.version})`);
            list.append(li);
        }
    }

    $("#legal-check").addEventListener("change", (e) => {
        $("#legal-accept").disabled = !e.target.checked;
    });
    $("#legal-accept").addEventListener("click", async () => {
        try {
            await api("/api/legal/accept", {
                method: "POST",
                body: { accept: true },
            });
            location.reload();
        } catch {
            toast("No se pudo registrar la aceptación.", false);
        }
    });

    $("#logout").addEventListener("click", async () => {
        try {
            await api("/auth/logout", { method: "POST", body: {} });
        } catch {
            /* aunque falle la red, salimos a la pantalla de login */
        }
        location.replace("/login?notice=signed_out");
    });

    $("#revoke-others").addEventListener("click", async () => {
        try {
            const r = await api("/api/sessions/revoke-others", {
                method: "POST",
                body: {},
            });
            toast(
                r.revoked
                    ? `Se cerraron ${r.revoked} sesión(es).`
                    : "No había otras sesiones.",
            );
            renderAccount(await api("/api/me"));
        } catch {
            toast("No se pudieron cerrar las sesiones.", false);
        }
    });

    $("#delete-confirm").addEventListener("input", (e) => {
        $("#delete-account").disabled = e.target.value !== "DELETE";
    });
    $("#delete-account").addEventListener("click", async () => {
        try {
            await api("/api/account/delete", {
                method: "POST",
                body: { confirm: $("#delete-confirm").value },
            });
            location.replace("/login?notice=deleted");
        } catch {
            toast("No se pudo eliminar la cuenta.", false);
        }
    });

    start().catch(() => toast("No se pudo cargar el panel.", false));
})();
