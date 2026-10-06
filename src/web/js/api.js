// Único punto de contacto con el backend. Mismo origen, sesión por cookie.
// El cliente no decide permisos ni valida nada de seguridad: el servidor
// vuelve a comprobarlo todo. Si la API cambia, se arregla solo aquí.
(() => {
    const P = (window.Purrfit = window.Purrfit || {});

    class ApiError extends Error {
        constructor(status, code, message, retryAfter = null) {
            super(code);
            this.status = status;
            this.code = code;
            this.serverMessage = message || "";
            this.retryAfter = retryAfter;
        }
    }

    let csrf = null;
    let sessionCache = null;

    async function rawFetch(path, options) {
        try {
            return await fetch(path, {
                credentials: "same-origin",
                cache: "no-store",
                ...options,
            });
        } catch {
            throw new ApiError(0, "network", "");
        }
    }

    /**
     * request(path, { method, body, publicEndpoint })
     * - Las mutaciones son POST con JSON y cabecera X-CSRF-Token.
     * - 401 en un endpoint privado: la sesión caducó, se va al login.
     */
    async function request(
        path,
        { method = "GET", body, publicEndpoint = false, _retry = false } = {},
    ) {
        const headers = { Accept: "application/json" };
        if (method !== "GET") {
            headers["Content-Type"] = "application/json";
            if (csrf) headers["X-CSRF-Token"] = csrf;
        }
        const res = await rawFetch(path, {
            method,
            headers,
            body: body === undefined ? undefined : JSON.stringify(body),
        });
        if (res.status === 401 && !publicEndpoint) {
            location.replace("/login?error=expired");
            throw new ApiError(401, "unauthenticated", "");
        }
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            const code = data && data.error ? String(data.error) : "error";
            // Token CSRF caducado (p. ej. sesión renovada): se pide uno nuevo una vez.
            if (res.status === 403 && code === "csrf" && !_retry) {
                await session(true);
                return request(path, {
                    method,
                    body,
                    publicEndpoint,
                    _retry: true,
                });
            }
            const retry = Number(res.headers.get("Retry-After"));
            throw new ApiError(
                res.status,
                code,
                data && data.message ? String(data.message) : "",
                Number.isFinite(retry) && retry > 0 ? retry : null,
            );
        }
        return data;
    }

    async function session(force = false) {
        if (sessionCache && !force) return sessionCache;
        const res = await rawFetch("/api/session", {
            headers: { Accept: "application/json" },
        });
        const data = await res.json().catch(() => ({}));
        if (data && data.authenticated) csrf = data.csrfToken;
        sessionCache = data;
        return data;
    }

    // Mensaje para personas, nunca el texto crudo de un error técnico.
    function describe(error, fallback = "Ocurrió un error inesperado.") {
        if (!(error instanceof ApiError)) return fallback;
        if (error.status === 0)
            return "Sin conexión con el servidor. Revisa tu red.";
        if (error.status === 429) {
            return error.retryAfter
                ? `Demasiadas peticiones. Inténtalo de nuevo en ${error.retryAfter} s.`
                : "Demasiadas peticiones. Espera un momento.";
        }
        if (error.status === 503)
            return "El servicio no está disponible por ahora.";
        if (error.code === "reauth_required")
            return "Tu sesión de Discord necesita renovarse.";
        if (error.code === "guild_not_found")
            return "Purrfit ya no está en ese servidor o no tienes acceso.";
        if (error.status >= 500)
            return "El servidor tuvo un problema. Inténtalo más tarde.";
        return error.serverMessage || fallback;
    }

    const enc = encodeURIComponent;

    P.api = {
        ApiError,
        describe,
        session,
        post: (path, body = {}) => request(path, { method: "POST", body }),

        // Cuenta y estado (existentes)
        me: () => request("/api/me"),
        status: () => request("/api/status"),
        activity: () => request("/api/activity"),
        acceptLegal: () => P.api.post("/api/legal/accept", { accept: true }),
        revokeOthers: () => P.api.post("/api/sessions/revoke-others"),
        deleteAccount: (confirm) =>
            P.api.post("/api/account/delete", { confirm }),
        logout: () => P.api.post("/auth/logout"),

        // Servidores
        guilds: () => request("/api/guilds"),
        guildSettings: (id) => request(`/api/guilds/${enc(id)}/settings`),
        saveGuildSettings: (id, patch) =>
            P.api.post(`/api/guilds/${enc(id)}/settings`, patch),

        // Públicos
        commands: () => request("/api/commands", { publicEndpoint: true }),
        marketAssets: () =>
            request("/api/market/assets", { publicEndpoint: true }),
        candles: ({ symbol, interval, limit, since }) => {
            const q = new URLSearchParams({ symbol, interval });
            if (limit) q.set("limit", String(limit));
            if (since !== undefined) q.set("since", String(since));
            return request(`/api/market/candles?${q}`, {
                publicEndpoint: true,
            });
        },
    };
})();
