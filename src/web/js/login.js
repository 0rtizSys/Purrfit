// Página de login. Solo UX: la validación real (state, aceptación, sesión) ocurre en el servidor.
(() => {
    const $ = (s) => document.querySelector(s);
    $("#year").textContent = new Date().getFullYear();

    // El servidor solo redirige con códigos de esta lista; cualquier otro valor se ignora.
    const MESSAGES = {
        denied: "Cancelaste el acceso en Discord. Puedes intentarlo de nuevo.",
        invalid:
            "No pudimos verificar el inicio de sesión (el enlace caducó o es inválido). Inténtalo de nuevo.",
        terms: "Para crear tu cuenta debes aceptar los Términos y la Política de Privacidad. Marca la casilla e inténtalo de nuevo.",
        unauthorized: "Esta cuenta no tiene acceso.",
        expired: "Tu sesión terminó. Inicia sesión otra vez.",
        temporary:
            "Discord o el servidor tuvieron un problema temporal. Inténtalo en unos minutos.",
        ratelimit:
            "Demasiados intentos. Espera un momento e inténtalo otra vez.",
        signed_out: "Cerraste sesión correctamente.",
        deleted: "Tu cuenta web fue eliminada.",
    };

    const params = new URLSearchParams(location.search);
    const code = params.get("error") || params.get("notice");
    const notice = $("#notice");
    if (code && Object.hasOwn(MESSAGES, code)) {
        notice.textContent = MESSAGES[code];
        notice.hidden = false;
        notice.classList.toggle("ok", !params.get("error"));
        if (code === "terms") $("#accept").focus();
    }

    // Con la casilla marcada, el servidor registra la aceptación al volver de Discord.
    const accept = $("#accept");
    const button = $("#login-btn");
    const sync = () => {
        button.href = accept.checked
            ? "/auth/discord?accept=1"
            : "/auth/discord";
    };
    accept.addEventListener("change", sync);
    sync();

    // Si ya hay sesión, ir directo al panel.
    fetch("/api/session", { credentials: "same-origin", cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((s) => {
            if (s && s.authenticated) location.replace("/dashboard");
        })
        .catch(() => {});
})();
