// Renderiza docs/TERMS.md y docs/PRIVACY.md (markdown crudo) con el estilo de la landing.
// Soporta lo que usan esos documentos: títulos, párrafos, listas, tablas,
// **negrita**, _cursiva_, `código` y [enlaces](url).
(() => {
    const DOCS = { "/terms": "TERMS", "/privacy": "PRIVACY" };
    const slug = DOCS[location.pathname.replace(/\/+$/, "")];
    const $ = (s) => document.querySelector(s);
    const doc = $("#doc"),
        toc = $("#toc");
    $("#year").textContent = new Date().getFullYear();

    document.querySelectorAll("[data-doc]").forEach((a) => {
        if (slug && a.dataset.doc === slug.toLowerCase())
            a.setAttribute("aria-current", "page");
    });

    const esc = (s) =>
        s.replace(
            /[&<>"]/g,
            (c) =>
                ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
        );

    // ./PRIVACY.md -> /privacy ; solo se permiten enlaces http(s), mailto y rutas del sitio
    const safeUrl = (u) => {
        const m = u.match(/^(?:\.\/)?(TERMS|PRIVACY)\.md$/i);
        if (m) return "/" + m[1].toLowerCase();
        return /^(https?:\/\/|mailto:|\/|#)/i.test(u) ? u : "#";
    };

    const inline = (raw) => {
        const codes = [];
        let s = esc(raw).replace(
            /`([^`]+)`/g,
            (_, c) => "\u0000" + (codes.push(c) - 1) + "\u0000",
        );
        s = s
            .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
            .replace(/(^|[\s(])_([^_]+)_(?=$|[\s).,;:])/g, "$1<em>$2</em>")
            .replace(
                /\[([^\]]+)\]\(([^)\s]+)\)/g,
                (_, t, u) =>
                    '<a href="' +
                    safeUrl(u.replace(/&amp;/g, "&")) +
                    '">' +
                    t +
                    "</a>",
            );
        return s.replace(
            /\u0000(\d+)\u0000/g,
            (_, i) => "<code>" + codes[i] + "</code>",
        );
    };

    const cells = (line) =>
        line
            .trim()
            .replace(/^\||\|$/g, "")
            .split("|")
            .map((c) => c.trim());
    const BLOCK_START = /^(#{1,3}\s|\s*[-*]\s|\s*\d+\.\s|\|)/;

    function render(md) {
        const lines = md.replace(/\r/g, "").split("\n");
        const out = [],
            heads = [];
        let title = "",
            updated = "",
            i = 0;
        while (i < lines.length) {
            const line = lines[i];
            let m;
            if (!line.trim()) {
                i++;
                continue;
            }
            if ((m = line.match(/^(#{1,3})\s+(.*)$/))) {
                const level = m[1].length;
                if (level === 1) title = m[2];
                else {
                    const id = "s-" + heads.length;
                    heads.push({ id, text: m[2] });
                    out.push(
                        "<h" +
                            level +
                            ' id="' +
                            id +
                            '">' +
                            inline(m[2]) +
                            "</h" +
                            level +
                            ">",
                    );
                }
                i++;
            } else if (/^_.*_$/.test(line.trim()) && !updated && !out.length) {
                updated = line.trim().slice(1, -1);
                i++;
            } else if (/^\s*[-*]\s+/.test(line)) {
                const items = [];
                while (i < lines.length && /^\s*[-*]\s+/.test(lines[i]))
                    items.push(
                        "<li>" +
                            inline(lines[i++].replace(/^\s*[-*]\s+/, "")) +
                            "</li>",
                    );
                out.push("<ul>" + items.join("") + "</ul>");
            } else if (/^\s*\d+\.\s+/.test(line)) {
                const items = [];
                while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i]))
                    items.push(
                        "<li>" +
                            inline(lines[i++].replace(/^\s*\d+\.\s+/, "")) +
                            "</li>",
                    );
                out.push("<ol>" + items.join("") + "</ol>");
            } else if (line.trim().startsWith("|")) {
                const rows = [];
                while (i < lines.length && lines[i].trim().startsWith("|"))
                    rows.push(lines[i++]);
                const head = cells(rows[0]);
                const body = rows.slice(2).map(cells);
                out.push(
                    '<div class="table-wrap"><table><thead><tr>' +
                        head.map((c) => "<th>" + inline(c) + "</th>").join("") +
                        "</tr></thead><tbody>" +
                        body
                            .map(
                                (r) =>
                                    "<tr>" +
                                    r
                                        .map(
                                            (c) => "<td>" + inline(c) + "</td>",
                                        )
                                        .join("") +
                                    "</tr>",
                            )
                            .join("") +
                        "</tbody></table></div>",
                );
            } else {
                const para = [];
                while (
                    i < lines.length &&
                    lines[i].trim() &&
                    !BLOCK_START.test(lines[i])
                )
                    para.push(lines[i++].trim());
                out.push("<p>" + inline(para.join(" ")) + "</p>");
            }
        }
        return { title, updated, html: out.join("\n"), heads };
    }

    if (!slug) {
        doc.innerHTML =
            '<h1>Not found</h1><p>That document does not exist. <a href="/">Back to the home page</a>.</p>';
        return;
    }

    fetch("/docs/" + slug + ".md")
        .then((r) => (r.ok ? r.text() : Promise.reject()))
        .then((md) => {
            const { title, updated, html, heads } = render(md);
            document.title = title + " — Purrfit";
            doc.innerHTML =
                '<p class="eyebrow">Legal</p><h1>' +
                esc(title) +
                "</h1>" +
                (updated
                    ? '<p class="updated">' +
                      esc(
                          updated
                              .replace(/Version:\s*/i, "Version ")
                              .replace(/Last updated:\s*/i, "Last updated "),
                      ) +
                      "</p>"
                    : "") +
                html;
            toc.innerHTML =
                "<p>On this page</p>" +
                heads
                    .map(
                        (h) =>
                            '<a href="#' + h.id + '">' + esc(h.text) + "</a>",
                    )
                    .join("");
            // Resalta la sección visible en el índice
            const links = [...toc.querySelectorAll("a")];
            if ("IntersectionObserver" in window) {
                const io = new IntersectionObserver(
                    (es) =>
                        es.forEach((e) => {
                            if (e.isIntersecting)
                                links.forEach((a) =>
                                    a.classList.toggle(
                                        "on",
                                        a.hash === "#" + e.target.id,
                                    ),
                                );
                        }),
                    { rootMargin: "-20% 0px -70% 0px" },
                );
                doc.querySelectorAll("h2").forEach((h) => io.observe(h));
            }
        })
        .catch(() => {
            doc.innerHTML =
                '<h1>Could not load the document</h1><p>Try again later or <a href="/">go back</a>.</p>';
        });
})();
