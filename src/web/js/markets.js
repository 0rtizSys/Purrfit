// Pestaña "Mercados": velas japonesas con TradingView Lightweight Charts.
// Al entrar se crea el gráfico, el ResizeObserver y el temporizador de refresco;
// al salir (o al ocultar la pestaña del navegador) todo se detiene y se libera.
(() => {
    const P = (window.Purrfit = window.Purrfit || {});
    const { $, h, fmt, roving } = P.ui;

    // Respaldo para poder pintar el selector aunque /api/market/assets falle.
    const FALLBACK = [
        { symbol: "PURR", name: "Purrcoin" },
        { symbol: "MEOW", name: "Meowthereum" },
        { symbol: "WSK", name: "Whisker Token" },
        { symbol: "NIP", name: "Catnip" },
        { symbol: "TUNA", name: "Tuna Stable" },
    ];
    const INTERVALS = [
        { id: "5m", step: 300, limit: 500 },
        { id: "15m", step: 900, limit: 500 },
        { id: "1h", step: 3600, limit: 500 },
        { id: "4h", step: 14400, limit: 300 },
        { id: "1d", step: 86400, limit: 120 },
    ];
    const REFRESH_MS = 15000;
    const VISIBLE_BARS = 90;
    const SKELETON_BARS = [
        38, 52, 44, 61, 70, 55, 48, 66, 78, 64, 58, 72, 84, 69, 60, 74, 88, 76,
        67, 81, 92, 80, 71, 85,
    ];

    const timeFmt = new Intl.DateTimeFormat("es", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    });
    const dayFmt = new Intl.DateTimeFormat("es", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
    const monthFmt = new Intl.DateTimeFormat("es", { month: "short" });
    const clockFmt = new Intl.DateTimeFormat("es", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
    });

    const s = {
        assets: FALLBACK.map((a) => ({ ...a })),
        assetsState: "idle", // idle | loading | ok | error
        symbol: "PURR",
        interval: "1h",
        chart: null,
        series: null,
        observer: null,
        raf: 0,
        timer: 0,
        gen: 0,
        busy: false,
        active: false,
        last: null,
        hasData: false,
        hover: false,
        precision: 2,
        colors: null,
        built: false,
    };
    let rowRefs = new Map();
    let pickRefs = new Map();

    const cfg = () =>
        INTERVALS.find((i) => i.id === s.interval) || INTERVALS[2];
    const asset = (symbol = s.symbol) =>
        s.assets.find((a) => a.symbol === symbol);
    const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);

    // ---------- Pintado del selector, la cabecera y la tabla ----------
    function paintChange(el, value) {
        const n = num(value);
        el.className = `chg ${n === null ? "flat" : fmt.trend(n)}`;
        el.textContent = n === null ? "—" : `${fmt.arrow(n)} ${fmt.percent(n)}`;
    }

    function buildPicker() {
        const box = $("#mk-picker");
        pickRefs = new Map();
        box.replaceChildren(
            ...s.assets.map((a) => {
                const price = h("span", { class: "px num", text: "—" });
                const chg = h("span", { class: "chg flat", text: "—" });
                const btn = h(
                    "button",
                    {
                        class: "seg",
                        data: { symbol: a.symbol },
                        attrs: {
                            type: "button",
                            role: "radio",
                            "aria-checked": "false",
                            tabindex: "-1",
                        },
                    },
                    h("span", { class: "sym", text: a.symbol }),
                    price,
                    chg,
                );
                btn.setAttribute(
                    "aria-label",
                    `${a.name || a.symbol} (${a.symbol})`,
                );
                pickRefs.set(a.symbol, { btn, price, chg });
                return btn;
            }),
        );
    }

    function buildTable() {
        const body = $("#mk-rows");
        rowRefs = new Map();
        body.replaceChildren(
            ...s.assets.map((a) => {
                const cells = {
                    price: h("td", { class: "num", data: { label: "Precio" } }),
                    chg: h("td", { class: "num", data: { label: "24 h" } }),
                    high: h("td", {
                        class: "num",
                        data: { label: "Máx. 24 h" },
                    }),
                    low: h("td", {
                        class: "num",
                        data: { label: "Mín. 24 h" },
                    }),
                };
                const bar = h(
                    "span",
                    { class: "range-bar", attrs: { "aria-hidden": "true" } },
                    h("i"),
                );
                const range = h(
                    "td",
                    { class: "range", data: { label: "Rango 24 h" } },
                    bar,
                );
                const btn = h(
                    "button",
                    {
                        class: "row-pick",
                        data: { symbol: a.symbol },
                        attrs: { type: "button", "aria-pressed": "false" },
                    },
                    h("b", { text: a.symbol }),
                    h("span", { text: a.name || "" }),
                );
                const tr = h(
                    "tr",
                    {},
                    h("th", { attrs: { scope: "row" } }, btn),
                    cells.price,
                    cells.chg,
                    cells.high,
                    cells.low,
                    range,
                );
                rowRefs.set(a.symbol, { tr, btn, bar, ...cells });
                return tr;
            }),
        );
    }

    function paintAssets() {
        for (const a of s.assets) {
            const p = pickRefs.get(a.symbol);
            const r = rowRefs.get(a.symbol);
            const price = num(a.price);
            if (p) {
                p.price.textContent = price === null ? "—" : fmt.price(price);
                paintChange(p.chg, a.change24hPercent);
            }
            if (r) {
                r.price.textContent = price === null ? "—" : fmt.price(price);
                paintChange(r.chg, a.change24hPercent);
                r.high.textContent =
                    num(a.high24h) === null ? "—" : fmt.price(a.high24h);
                r.low.textContent =
                    num(a.low24h) === null ? "—" : fmt.price(a.low24h);
                const hi = num(a.high24h);
                const lo = num(a.low24h);
                let pos = 50;
                if (price !== null && hi !== null && lo !== null && hi > lo)
                    pos = Math.min(
                        100,
                        Math.max(0, ((price - lo) / (hi - lo)) * 100),
                    );
                r.bar.firstElementChild.style.left = `${pos}%`;
            }
        }
        paintSelection();
    }

    function paintSelection() {
        for (const [sym, p] of pickRefs) {
            const on = sym === s.symbol;
            p.btn.setAttribute("aria-checked", String(on));
            p.btn.tabIndex = on ? 0 : -1;
        }
        for (const [sym, r] of rowRefs) {
            const on = sym === s.symbol;
            r.btn.setAttribute("aria-pressed", String(on));
            r.tr.classList.toggle("selected", on);
        }
        for (const btn of document.querySelectorAll("#mk-intervals .seg")) {
            const on = btn.dataset.interval === s.interval;
            btn.setAttribute("aria-checked", String(on));
            btn.tabIndex = on ? 0 : -1;
        }
        const a = asset();
        $("#mk-sym").textContent = s.symbol;
        $("#mk-name").textContent = a && a.name ? a.name : "";
        const price = a ? num(a.price) : null;
        const shown = price !== null ? price : s.last ? s.last.close : null;
        $("#mk-price").textContent = shown === null ? "—" : fmt.price(shown);
        paintChange($("#mk-change"), a ? a.change24hPercent : null);
        $("#mk-chart").setAttribute(
            "aria-label",
            `Gráfico de velas de ${s.symbol}, intervalo ${s.interval}.${shown === null ? "" : ` Último precio ${fmt.price(shown)}.`}`,
        );
    }

    function setLive(ok, text) {
        const box = $("#mk-live");
        if (!box) return;
        box.classList.toggle("off", !ok);
        $("#mk-live-text").textContent = text;
    }

    // ---------- Datos ----------
    async function refreshAssets() {
        try {
            const data = await P.api.marketAssets();
            const list = Array.isArray(data.assets)
                ? data.assets.filter((a) => a && typeof a.symbol === "string")
                : [];
            if (!list.length) throw new Error("empty");
            const same =
                list.length === s.assets.length &&
                list.every((a, i) => a.symbol === s.assets[i].symbol);
            s.assets = list;
            s.assetsState = "ok";
            if (!list.some((a) => a.symbol === s.symbol))
                s.symbol = list[0].symbol;
            if (!same || !s.built) {
                buildPicker();
                buildTable();
                s.built = true;
            }
            paintAssets();
            $("#mk-table-state").hidden = true;
            return true;
        } catch {
            if (s.assetsState !== "ok") {
                s.assetsState = "error";
                const box = $("#mk-table-state");
                box.hidden = false;
            }
            return false;
        }
    }

    function cleanCandles(raw) {
        if (!Array.isArray(raw)) return [];
        const out = [];
        for (const c of raw) {
            if (!c) continue;
            const t = Number(c.time);
            const o = Number(c.open);
            const hi = Number(c.high);
            const lo = Number(c.low);
            const cl = Number(c.close);
            if (![t, o, hi, lo, cl].every(Number.isFinite)) continue;
            out.push({ time: t, open: o, high: hi, low: lo, close: cl });
        }
        out.sort((a, b) => a.time - b.time);
        return out.filter((c, i) => i === 0 || c.time !== out[i - 1].time);
    }

    function applyPrecision(candles) {
        const lows = candles.map((c) => c.low).filter((v) => v > 0);
        const ref = lows.length
            ? Math.min(...lows)
            : candles[candles.length - 1].close;
        s.precision = fmt.decimalsFor(ref);
        s.series.applyOptions({
            //? Custom, so the axis uses the same Spanish number format as the
            //? legend (1.234,50 would read "1.6200" as 16200 with the default)
            priceFormat: {
                type: "custom",
                minMove: 1 / 10 ** s.precision,
                formatter: (value) => fmt.price(value, s.precision),
            },
        });
    }

    // ---------- Superposición: carga, vacío, error ----------
    function overlay(kind, message) {
        const box = $("#mk-overlay");
        if (!kind) {
            box.hidden = true;
            box.replaceChildren();
            return;
        }
        box.hidden = false;
        box.dataset.kind = kind;
        if (kind === "loading") {
            const bars = SKELETON_BARS.map((v, i) => {
                const bar = h("span", { class: "sk-candle" });
                bar.style.height = `${v}%`;
                bar.style.animationDelay = `${(i % 8) * 90}ms`;
                return bar;
            });
            box.replaceChildren(
                h(
                    "div",
                    { class: "sk-candles", attrs: { "aria-hidden": "true" } },
                    bars,
                ),
                h("span", { class: "sr-only", text: "Cargando velas…" }),
            );
        } else if (kind === "empty") {
            box.replaceChildren(
                h(
                    "div",
                    { class: "overlay-msg" },
                    h("strong", { text: "Sin datos todavía" }),
                    h("p", {
                        text: "Purrfit guarda una vela cada 5 minutos. Vuelve en un rato.",
                    }),
                ),
            );
        } else {
            box.replaceChildren(
                h(
                    "div",
                    { class: "overlay-msg" },
                    h("strong", { text: "No se pudo cargar el gráfico" }),
                    h("p", { text: message }),
                    h("button", {
                        class: "btn btn-small btn-ghost",
                        text: "Reintentar",
                        attrs: { type: "button" },
                        on: { click: () => loadChart() },
                    }),
                ),
            );
        }
    }

    // ---------- Leyenda OHLC ----------
    function paintLegend(c) {
        const legend = $("#mk-legend");
        if (!c) {
            legend.hidden = true;
            return;
        }
        legend.hidden = false;
        const t = typeof c.time === "number" ? c.time * 1000 : 0;
        $("#lg-time").textContent = t
            ? (s.interval === "1d" ? dayFmt : timeFmt).format(t)
            : "";
        $("#lg-o").textContent = fmt.price(c.open, s.precision);
        $("#lg-h").textContent = fmt.price(c.high, s.precision);
        $("#lg-l").textContent = fmt.price(c.low, s.precision);
        $("#lg-c").textContent = fmt.price(c.close, s.precision);
        const pct = c.open ? ((c.close - c.open) / c.open) * 100 : 0;
        const ch = $("#lg-ch");
        ch.textContent = fmt.percent(pct);
        legend.className = `mk-legend ${fmt.trend(c.close - c.open)}`;
    }

    function onCrosshair(param) {
        const d =
            param && param.time && param.seriesData
                ? param.seriesData.get(s.series)
                : null;
        if (!d || d.open === undefined) {
            s.hover = false;
            paintLegend(s.last);
            return;
        }
        s.hover = true;
        paintLegend({
            time: param.time,
            open: d.open,
            high: d.high,
            low: d.low,
            close: d.close,
        });
    }

    // ---------- Gráfico ----------
    function readColors() {
        const css = getComputedStyle($("#panel-mercados"));
        const v = (name, fallback) =>
            css.getPropertyValue(name).trim() || fallback;
        return {
            up: v("--mk-up", "#34c77b"),
            down: v("--mk-down", "#e5675a"),
            text: v("--mk-text", "#94a29a"),
            grid: v("--mk-grid", "rgba(238, 242, 234, 0.05)"),
            axis: v("--mk-axis", "rgba(232, 184, 74, 0.14)"),
            cross: v("--mk-cross", "rgba(232, 184, 74, 0.5)"),
            label: v("--mk-label", "#1b2420"),
        };
    }

    function createChartOnce() {
        const LW = window.LightweightCharts;
        if (!LW) throw new Error("no_charts_lib");
        const el = $("#mk-chart");
        const c = (s.colors = readColors());
        const hairline = {
            color: c.cross,
            width: 1,
            style: LW.LineStyle.Dashed,
            labelBackgroundColor: c.label,
        };
        s.chart = LW.createChart(el, {
            layout: {
                background: {
                    type: LW.ColorType.Solid,
                    color: "rgba(0, 0, 0, 0)",
                },
                textColor: c.text,
                fontFamily: getComputedStyle(document.body).fontFamily,
                fontSize: 12,
                attributionLogo: false, // la atribución visible está en el pie del gráfico
            },
            grid: {
                vertLines: { color: c.grid },
                horzLines: { color: c.grid },
            },
            crosshair: {
                mode: LW.CrosshairMode.Normal,
                vertLine: hairline,
                horzLine: hairline,
            },
            rightPriceScale: {
                borderColor: c.axis,
                scaleMargins: { top: 0.1, bottom: 0.08 },
            },
            timeScale: {
                borderColor: c.axis,
                timeVisible: s.interval !== "1d",
                secondsVisible: false,
                rightOffset: 6,
                barSpacing: 9,
                minBarSpacing: 2,
                tickMarkFormatter: (time, type) => {
                    const d = new Date(Number(time) * 1000);
                    if (type === LW.TickMarkType.Year)
                        return String(d.getFullYear());
                    if (type === LW.TickMarkType.Month)
                        return monthFmt.format(d);
                    if (type === LW.TickMarkType.DayOfMonth)
                        return String(d.getDate());
                    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
                },
            },
            localization: {
                locale: "es",
                timeFormatter: (time) =>
                    (s.interval === "1d" ? dayFmt : timeFmt).format(
                        Number(time) * 1000,
                    ),
            },
        });
        s.series = s.chart.addSeries(LW.CandlestickSeries, {
            upColor: c.up,
            downColor: c.down,
            wickUpColor: c.up,
            wickDownColor: c.down,
            borderVisible: false,
            lastValueVisible: true,
            priceLineVisible: true,
            priceLineStyle: LW.LineStyle.Dashed,
            priceLineWidth: 1,
        });
        s.chart.subscribeCrosshairMove(onCrosshair);

        s.observer = new ResizeObserver((entries) => {
            const box = entries[entries.length - 1].contentRect;
            cancelAnimationFrame(s.raf);
            s.raf = requestAnimationFrame(() => {
                if (s.chart && box.width > 0 && box.height > 0)
                    s.chart.resize(
                        Math.floor(box.width),
                        Math.floor(box.height),
                    );
            });
        });
        s.observer.observe(el);
    }

    async function loadChart({ silent = false } = {}) {
        if (!s.chart) return;
        const gen = ++s.gen;
        const { symbol, interval } = s;
        if (!silent) {
            s.last = null;
            s.hasData = false;
            s.series.setData([]);
            paintLegend(null);
            overlay("loading");
        }
        try {
            const data = await P.api.candles({
                symbol,
                interval,
                limit: cfg().limit,
            });
            if (gen !== s.gen || !s.chart) return;
            const candles = cleanCandles(data.candles);
            if (!candles.length) {
                s.hasData = false;
                s.last = null;
                s.series.setData([]);
                paintLegend(null);
                overlay("empty");
                return;
            }
            applyPrecision(candles);
            s.series.setData(candles);
            s.last = candles[candles.length - 1];
            s.hasData = true;
            const n = candles.length;
            if (n > VISIBLE_BARS)
                s.chart.timeScale().setVisibleLogicalRange({
                    from: n - VISIBLE_BARS,
                    to: n + 6,
                });
            else s.chart.timeScale().fitContent();
            s.chart
                .timeScale()
                .applyOptions({ timeVisible: interval !== "1d" });
            overlay(null);
            if (!s.hover) paintLegend(s.last);
            paintSelection();
        } catch (e) {
            if (gen !== s.gen || !s.chart) return;
            if (silent && !s.hasData) return;
            overlay(
                "error",
                P.api.describe(e, "Inténtalo de nuevo en un momento."),
            );
        }
    }

    // Refresco ligero: solo velas posteriores a la última (más precios del resumen).
    async function tick() {
        if (!s.active || s.busy || document.visibilityState !== "visible")
            return;
        s.busy = true;
        const gen = s.gen;
        try {
            const missing = s.last
                ? (Date.now() / 1000 - s.last.time) / cfg().step
                : Infinity;
            const needFull = !s.hasData || missing > 150;
            const [assetsOk, candlesRes] = await Promise.all([
                refreshAssets(),
                needFull
                    ? Promise.resolve(null)
                    : P.api
                          .candles({
                              symbol: s.symbol,
                              interval: s.interval,
                              since: s.last.time - 1,
                              limit: 300,
                          })
                          .then(
                              (d) => d,
                              () => false,
                          ),
            ]);
            if (!s.active) return;
            let live = assetsOk;
            if (needFull) {
                await loadChart({ silent: true });
                live = live || s.hasData;
            } else if (candlesRes === false) {
                live = false;
            } else if (candlesRes && gen === s.gen && s.series) {
                for (const c of cleanCandles(candlesRes.candles)) {
                    if (s.last && c.time < s.last.time) continue;
                    s.series.update(c);
                    s.last = c;
                }
                if (!s.hover) paintLegend(s.last);
                live = true;
            }
            paintSelection();
            setLive(
                live,
                live
                    ? `En vivo · ${clockFmt.format(new Date())}`
                    : "Sin conexión · reintentando",
            );
        } finally {
            s.busy = false;
        }
    }

    function startTimer() {
        clearInterval(s.timer);
        s.timer = setInterval(tick, REFRESH_MS);
    }
    function onVisibility() {
        if (!s.active) return;
        if (document.visibilityState === "visible") {
            tick();
            startTimer();
        } else {
            clearInterval(s.timer);
        }
    }

    // ---------- Selección ----------
    function setSymbol(symbol) {
        if (symbol === s.symbol) return;
        s.symbol = symbol;
        paintSelection();
        loadChart();
    }
    function pickInterval(id) {
        if (id === s.interval) return;
        s.interval = id;
        paintSelection();
        loadChart();
    }

    function buildIntervals() {
        const box = $("#mk-intervals");
        box.replaceChildren(
            ...INTERVALS.map((i) =>
                h("button", {
                    class: "seg small",
                    text: i.id,
                    data: { interval: i.id },
                    attrs: {
                        type: "button",
                        role: "radio",
                        "aria-checked": "false",
                        tabindex: "-1",
                    },
                }),
            ),
        );
    }

    function init() {
        buildIntervals();
        buildPicker();
        buildTable();
        s.built = false;
        $("#mk-picker").addEventListener("click", (e) => {
            const b = e.target.closest(".seg");
            if (b) setSymbol(b.dataset.symbol);
        });
        roving($("#mk-picker"), ".seg", (b) => setSymbol(b.dataset.symbol));
        $("#mk-intervals").addEventListener("click", (e) => {
            const b = e.target.closest(".seg");
            if (b) pickInterval(b.dataset.interval);
        });
        roving($("#mk-intervals"), ".seg", (b) =>
            pickInterval(b.dataset.interval),
        );
        $("#mk-rows").addEventListener("click", (e) => {
            const b = e.target.closest(".row-pick");
            if (b) setSymbol(b.dataset.symbol);
        });
        $("#mk-table-retry").addEventListener("click", refreshAssets);
    }

    function teardown() {
        s.active = false;
        s.gen += 1;
        clearInterval(s.timer);
        cancelAnimationFrame(s.raf);
        document.removeEventListener("visibilitychange", onVisibility);
        s.observer?.disconnect();
        s.observer = null;
        if (s.chart) {
            s.chart.remove();
            s.chart = null;
            s.series = null;
        }
        s.last = null;
        s.hasData = false;
        s.hover = false;
    }

    let inited = false;
    P.tabs.register("mercados", {
        onShow() {
            if (!inited) {
                inited = true;
                init();
            }
            s.active = true;
            paintSelection();
            paintAssets();
            setLive(true, "Conectando…");
            try {
                createChartOnce();
            } catch {
                overlay("error", "No se pudo cargar el motor de gráficos.");
                return;
            }
            document.addEventListener("visibilitychange", onVisibility);
            loadChart();
            refreshAssets().then((ok) => {
                if (s.active)
                    setLive(
                        ok,
                        ok
                            ? `En vivo · ${clockFmt.format(new Date())}`
                            : "Sin conexión · reintentando",
                    );
            });
            startTimer();
        },
        onHide: teardown,
    });
})();
