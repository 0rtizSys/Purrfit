import { createCanvas } from "@napi-rs/canvas";
import type { PricePoint } from "../database/repository/crypto/market";

const WIDTH = 900;
const HEIGHT = 450;
const PADDING = { top: 56, right: 24, bottom: 48, left: 88 };

const COLORS = {
    background: "#1e1f22",
    grid: "#2f3136",
    axisText: "#b5bac1",
    title: "#f2f3f5",
    up: "#23a55a",
    down: "#f23f43",
};

export function formatPrice(price: number): string {
    if (price >= 1000)
        return price.toLocaleString("en-US", { maximumFractionDigits: 0 });
    if (price >= 1)
        return price.toLocaleString("en-US", { maximumFractionDigits: 2 });
    return price.toLocaleString("en-US", { maximumSignificantDigits: 4 });
}

function formatTime(date: Date, spanMs: number): string {
    const iso = date.toISOString();
    //? Short ranges show the hour, long ranges show the day (UTC)
    return spanMs <= 36 * 60 * 60 * 1000 ? iso.slice(11, 16) : iso.slice(5, 10);
}

/** Renders a line chart of `points` as a PNG buffer. */
export function renderPriceChart(title: string, points: PricePoint[]): Buffer {
    const canvas = createCanvas(WIDTH, HEIGHT);
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    const plotW = WIDTH - PADDING.left - PADDING.right;
    const plotH = HEIGHT - PADDING.top - PADDING.bottom;

    const prices = points.map((p) => p.price);
    let min = Math.min(...prices);
    let max = Math.max(...prices);
    if (min === max) {
        min *= 0.99;
        max *= 1.01;
    }
    const first = points[0];
    const last = points[points.length - 1];
    const spanMs = Math.max(last.at.getTime() - first.at.getTime(), 1);
    const lineColor = last.price >= first.price ? COLORS.up : COLORS.down;

    const x = (at: Date) =>
        PADDING.left + ((at.getTime() - first.at.getTime()) / spanMs) * plotW;
    const y = (price: number) =>
        PADDING.top + (1 - (price - min) / (max - min)) * plotH;

    ctx.font = "bold 22px sans-serif";
    ctx.fillStyle = COLORS.title;
    ctx.textBaseline = "middle";
    ctx.fillText(title, PADDING.left, PADDING.top / 2);

    ctx.font = "14px sans-serif";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
        const value = min + ((max - min) * i) / 4;
        const gy = y(value);
        ctx.strokeStyle = COLORS.grid;
        ctx.beginPath();
        ctx.moveTo(PADDING.left, gy);
        ctx.lineTo(WIDTH - PADDING.right, gy);
        ctx.stroke();
        ctx.fillStyle = COLORS.axisText;
        ctx.textAlign = "right";
        ctx.fillText(formatPrice(value), PADDING.left - 10, gy);
    }

    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    for (let i = 0; i <= 4; i++) {
        const at = new Date(first.at.getTime() + (spanMs * i) / 4);
        ctx.fillStyle = COLORS.axisText;
        ctx.fillText(
            formatTime(at, spanMs),
            x(at),
            HEIGHT - PADDING.bottom + 12,
        );
    }

    if (points.length > 1) {
        const gradient = ctx.createLinearGradient(
            0,
            PADDING.top,
            0,
            HEIGHT - PADDING.bottom,
        );
        gradient.addColorStop(0, lineColor + "55");
        gradient.addColorStop(1, lineColor + "00");
        ctx.beginPath();
        ctx.moveTo(x(first.at), HEIGHT - PADDING.bottom);
        for (const p of points) ctx.lineTo(x(p.at), y(p.price));
        ctx.lineTo(x(last.at), HEIGHT - PADDING.bottom);
        ctx.closePath();
        ctx.fillStyle = gradient;
        ctx.fill();

        ctx.beginPath();
        points.forEach((p, i) =>
            i === 0
                ? ctx.moveTo(x(p.at), y(p.price))
                : ctx.lineTo(x(p.at), y(p.price)),
        );
        ctx.strokeStyle = lineColor;
        ctx.lineWidth = 2.5;
        ctx.stroke();
    }

    return canvas.toBuffer("image/png");
}
