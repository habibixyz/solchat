// ⚡ Solchat Layout Engine (safe + fast)

let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;

function getCtx() {
  if (!canvas) {
    canvas = document.createElement("canvas");
    ctx = canvas.getContext("2d");
  }
  return ctx;
}

type LayoutResult = {
  lines: string[];
  height: number;
};

const cache = new Map<string, LayoutResult>();

export function measureMessage(text: string, maxWidth: number): LayoutResult {
  if (!text) return { lines: [], height: 0 };

  const key = text + "_" + maxWidth;
  if (cache.has(key)) return cache.get(key)!;

  const ctx = getCtx();
  if (!ctx) return { lines: [text], height: 22 };

  ctx.font = "15px Space Mono";

  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";

  for (let w of words) {
    const test = current ? current + " " + w : w;
    const width = ctx.measureText(test).width;

    if (width > maxWidth && current) {
      lines.push(current);
      current = w;
    } else {
      current = test;
    }
  }

  if (current) lines.push(current);

  const result = {
    lines,
    height: Math.max(lines.length * 22, 22),
  };

  cache.set(key, result);
  return result;
}
