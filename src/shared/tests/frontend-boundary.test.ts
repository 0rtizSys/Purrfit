import fs from "fs";
import path from "path";

/**
 * src/web is the PUBLIC frontend: it must stay a plain client of an API that
 * lives elsewhere (a private repository). If any server code, secret, query or
 * source map ends up here, this test fails before it can be pushed.
 */
const WEB = path.resolve(__dirname, "..", "..", "web");

function walk(dir: string): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const full = path.join(dir, entry.name);
        return entry.isDirectory() ? walk(full) : [full];
    });
}

const files = walk(WEB);

describe("public frontend boundary (src/web)", () => {
    it("holds only html, css and js: no server files, source maps or dotfiles", () => {
        for (const file of files) {
            const rel = path.relative(WEB, file).split(path.sep).join("/");
            expect(rel).toMatch(/\.(html|css|js)$/);
            expect(path.basename(rel)).not.toMatch(/^\./);
        }
        expect(files.map((f) => path.basename(f))).not.toContain("server.js");
    });

    it("contains no secrets, SQL, server internals or browser-side session storage", () => {
        const forbidden = [
            "process.env",
            "require(",
            "DATABASE_URL",
            "CLIENT_SECRET",
            "client_secret",
            "SESSION_SECRET",
            "SELECT ",
            "INSERT INTO",
            "DELETE FROM",
            "web_sessions",
            "web_users",
            "localStorage",
            "sessionStorage",
            "document.cookie",
            "eval(",
        ];
        for (const file of files) {
            const text = fs.readFileSync(file, "utf8");
            for (const needle of forbidden) {
                expect({
                    file: path.basename(file),
                    needle,
                    found: text.includes(needle),
                }).toEqual({
                    file: path.basename(file),
                    needle,
                    found: false,
                });
            }
        }
    });

    it("works under a strict CSP: no inline scripts, handlers or style attributes", () => {
        for (const file of files.filter((f) => f.endsWith(".html"))) {
            const html = fs.readFileSync(file, "utf8");
            expect(html).not.toMatch(/<script(?![^>]*\bsrc=)[^>]*>/i);
            expect(html).not.toMatch(/\son[a-z]+\s*=/i);
            expect(html).not.toMatch(/\sstyle\s*=/i);
        }
    });

    it("never builds HTML from data with innerHTML in account pages", () => {
        for (const name of ["dashboard.js", "login.js"]) {
            const text = fs.readFileSync(path.join(WEB, "js", name), "utf8");
            expect(text).not.toMatch(
                /\.innerHTML\s*=|insertAdjacentHTML|document\.write/,
            );
        }
    });

    it("legal documents carry the version line the backend reads", () => {
        for (const name of ["TERMS.md", "PRIVACY.md"]) {
            const text = fs.readFileSync(
                path.resolve(WEB, "..", "..", "docs", name),
                "utf8",
            );
            expect(text).toMatch(/^_Version:\s*[A-Za-z0-9._-]+/m);
        }
    });
});
