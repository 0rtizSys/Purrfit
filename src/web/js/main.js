(() => {
    const cfg = window.PURRFIT;
    const $ = (s, r = document) => r.querySelector(s);
    const $$ = (s, r = document) => [...r.querySelectorAll(s)];

    // Enlaces e invitación: los valores reales vienen del servidor (/api/config, .env)
    const wire = (el, url, hint) => {
        if (url) {
            el.href = url;
            el.removeAttribute("aria-disabled");
            el.style.opacity = "";
            el.title = "";
            return;
        }
        el.removeAttribute("href");
        el.setAttribute("aria-disabled", "true");
        el.title = hint;
        el.style.opacity = ".5";
    };
    const applyConfig = (c) => {
        const targets = {
            terms: c.termsUrl,
            privacy: c.privacyUrl,
            support: c.supportUrl,
            email: c.contactEmail ? `mailto:${c.contactEmail}` : null,
        };
        $$("[data-invite]").forEach((a) =>
            wire(
                a,
                c.inviteReady ? "/invite" : null,
                "La invitación aún no está configurada (CLIENT_ID en .env)",
            ),
        );
        $$("[data-link]").forEach((a) =>
            wire(a, targets[a.dataset.link], "Aún no configurado en .env"),
        );

        const perms = $("#perms");
        if (perms && c.permissions) {
            perms.replaceChildren(
                ...c.permissions.map((p) => {
                    const li = document.createElement("li");
                    const b = document.createElement("b"),
                        s = document.createElement("span");
                    b.textContent = p.name;
                    s.textContent = p.why;
                    li.append(b, s);
                    return li;
                }),
            );
        }
        const copy = $("#copy-invite");
        if (copy) {
            copy.disabled = !c.inviteReady;
            copy.onclick = async () => {
                try {
                    await navigator.clipboard.writeText(
                        new URL("/invite", location.href).href,
                    );
                    copy.textContent = "¡Copiado!";
                } catch {
                    copy.textContent =
                        "Copia: " + new URL("/invite", location.href).href;
                }
                setTimeout(() => {
                    copy.textContent = "Copiar enlace";
                }, 2200);
            };
        }
    };
    applyConfig({ inviteReady: false });
    fetch("/api/config")
        .then((r) => r.json())
        .then(applyConfig)
        .catch(() => {});

    // Comandos con filtro por categoría
    const cats = ["Todos", ...new Set(cfg.COMMANDS.map((c) => c.cat))];
    const tabs = $("#tabs"),
        list = $("#commands");
    let active = "Todos";
    const render = () => {
        $$("button", tabs).forEach((b) =>
            b.setAttribute("aria-pressed", b.textContent === active),
        );
        list.replaceChildren(
            ...cfg.COMMANDS.filter(
                (c) => active === "Todos" || c.cat === active,
            ).map((c) => {
                const li = document.createElement("li");
                const code = document.createElement("code");
                const span = document.createElement("span");
                code.textContent = c.name;
                span.textContent = c.desc;
                li.append(code, span);
                return li;
            }),
        );
    };
    cats.forEach((cat) => {
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = cat;
        b.addEventListener("click", () => {
            active = cat;
            render();
        });
        tabs.append(b);
    });
    render();

    $("#coins").textContent = cfg.COINS_LIST.map(
        (c) => `${c.name} (${c.sym})`,
    ).join(", ");
    $("#year").textContent = new Date().getFullYear();

    // Ticker: la lista se duplica para que el bucle del -50% no tenga saltos.
    // Los precios reales llegan de /api/market (snapshot del worker, cada 2 min).
    const ticker = $("#ticker");
    const item = (c) => {
        const d = document.createElement("div");
        d.className = "tick";
        d.dataset.sym = c.sym;
        const b = document.createElement("b"),
            n = document.createElement("span"),
            p = document.createElement("span");
        b.textContent = c.sym;
        n.textContent = `${c.name} · simulada`;
        p.className = "px";
        d.append(b, n, p);
        return d;
    };
    for (let i = 0; i < 4; i++)
        cfg.COINS_LIST.forEach((c) => ticker.append(item(c)));

    const fmtPrice = (v) =>
        v.toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: v < 1 ? 6 : 2,
        });
    const applyMarket = (snap) => {
        const bySym = new Map(snap.assets.map((a) => [a.symbol, a]));
        $$(".tick", ticker).forEach((el) => {
            const a = bySym.get(el.dataset.sym);
            const px = $(".px", el);
            if (!a) {
                px.textContent = "";
                return;
            }
            const ch = a.change24hPct;
            const cls = ch >= 0 ? "up" : "down";
            px.replaceChildren();
            const price = document.createElement("strong"),
                delta = document.createElement("em");
            price.textContent = fmtPrice(a.price);
            delta.className = cls;
            delta.textContent = `${ch >= 0 ? "▲" : "▼"} ${Math.abs(ch).toFixed(2)}%`;
            px.append(price, delta);
        });
    };
    const refreshMarket = () =>
        fetch("/api/market", { cache: "no-store" })
            .then((r) => (r.ok ? r.json() : Promise.reject()))
            .then(applyMarket)
            .catch(() => {}); // sin datos: el ticker se queda con los nombres
    refreshMarket();
    setInterval(refreshMarket, 2 * 60 * 1000);

    // Estilo del nav al hacer scroll
    const nav = $("#nav");
    const onScroll = () => nav.classList.toggle("scrolled", window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Aparición al hacer scroll
    const reveals = $$(".reveal");
    if ("IntersectionObserver" in window && !reduce) {
        const io = new IntersectionObserver(
            (entries) =>
                entries.forEach((e) => {
                    if (e.isIntersecting) {
                        e.target.classList.add("in");
                        io.unobserve(e.target);
                    }
                }),
            { threshold: 0.15 },
        );
        reveals.forEach((el, i) => {
            el.style.transitionDelay = `${(i % 3) * 80}ms`;
            io.observe(el);
        });
    } else {
        reveals.forEach((el) => el.classList.add("in"));
    }

    // Contadores
    $$("[data-count]").forEach((el) => {
        const end = Number(el.dataset.count);
        if (reduce) {
            el.textContent = end;
            return;
        }
        const t0 = performance.now(),
            dur = 1200;
        const step = (now) => {
            const p = Math.min((now - t0) / dur, 1);
            el.textContent = Math.round(end * (1 - Math.pow(1 - p, 3)));
            if (p < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
    });

    // Inclinación sutil del retrato con el mouse
    const art = $(".hero-art"),
        portrait = $("#portrait");
    if (!reduce && matchMedia("(hover: hover)").matches) {
        art.addEventListener("mousemove", (e) => {
            const r = art.getBoundingClientRect();
            const x = (e.clientX - r.left) / r.width - 0.5,
                y = (e.clientY - r.top) / r.height - 0.5;
            portrait.style.transform = `perspective(700px) rotateY(${x * 8}deg) rotateX(${-y * 8}deg)`;
        });
        art.addEventListener("mouseleave", () => {
            portrait.style.transform = "";
        });
    }
})();
