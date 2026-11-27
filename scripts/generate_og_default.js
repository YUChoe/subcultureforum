/**
 * 기본 OG 이미지(public/images/og-default.png, 1200x630) 생성 스크립트.
 * 외부 의존성 없이 zlib 만으로 PNG 를 직접 만든다. 로고(public/favicon.svg)의 색상/구성을 따른다.
 *
 * 사용법: node scripts/generate_og_default.js
 * 게시글별 생성 이미지를 추가하게 되면 이 래스터라이저 대신 별도 생성기를 SEOService.resolveOgImage() 에 연결한다.
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const WIDTH = 1200;
const HEIGHT = 630;
const SAMPLES = 2; // 축마다 2x2 슈퍼샘플링 (안티앨리어싱)

const COLOR_START = [0x66, 0x7e, 0xea]; // #667eea
const COLOR_END = [0x76, 0x4b, 0xa2]; // #764ba2
const WHITE = [255, 255, 255];

// ---- 도형 정의 ----

// 로고 타일 (favicon.svg 의 100x100 viewBox 를 TILE/100 배)
const TILE = { x: 110, y: 165, size: 300 };
const TILE_RADIUS = TILE.size * 0.2;
const TILE_SCALE = TILE.size / 100;
const BUBBLES = [
    { cx: 25, cy: 22, r: 15, color: [0xff, 0xd7, 0x00], alpha: 0.7 },
    { cx: 22, cy: 30, r: 5, color: [0xff, 0xd7, 0x00], alpha: 0.7 },
    { cx: 75, cy: 25, r: 13, color: [0xff, 0xc1, 0x07], alpha: 0.65 },
    { cx: 78, cy: 32, r: 4, color: [0xff, 0xc1, 0x07], alpha: 0.65 },
    { cx: 20, cy: 75, r: 12, color: [0xff, 0xeb, 0x3b], alpha: 0.6 },
    { cx: 17, cy: 83, r: 4, color: [0xff, 0xeb, 0x3b], alpha: 0.6 }
];

// 단순 획 글꼴: 글자 상자(0..1, 0..1) 안의 선분 목록
const GLYPHS = {
    N: [[0, 1, 0, 0], [0, 0, 1, 1], [1, 1, 1, 0]],
    O: [[0, 0, 1, 0], [1, 0, 1, 1], [1, 1, 0, 1], [0, 1, 0, 0]],
    I: [[0.5, 0, 0.5, 1]],
    Z: [[0, 0, 1, 0], [1, 0, 0, 1], [0, 1, 1, 1]],
    E: [[1, 0, 0, 0], [0, 0, 0, 1], [0, 1, 1, 1], [0, 0.5, 0.8, 0.5]]
};

function buildSegments(text, originX, originY, letterW, letterH, gap) {
    const segments = [];
    let x = originX;
    for (const ch of text) {
        const width = ch === 'I' ? letterW * 0.15 : letterW;
        for (const [x1, y1, x2, y2] of GLYPHS[ch]) {
            segments.push([x + x1 * width, originY + y1 * letterH, x + x2 * width, originY + y2 * letterH]);
        }
        x += width + gap;
    }
    return segments;
}

const WORDMARK = buildSegments('NOIZZE', 500, 255, 82, 120, 26);
const WORDMARK_HALF_STROKE = 11;

// 타일 안의 N (타일 좌표 -> 절대 좌표)
const TILE_N = [[0, 1, 0, 0], [0, 0, 1, 1], [1, 1, 1, 0]].map(([x1, y1, x2, y2]) => {
    const left = TILE.x + 98;
    const top = TILE.y + 82;
    const w = 104;
    const h = 130;
    return [left + x1 * w, top + y1 * h, left + x2 * w, top + y2 * h];
});
const TILE_N_HALF_STROKE = 17;

// ---- 래스터화 ----

function distToSegment(px, py, [x1, y1, x2, y2]) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lengthSq = dx * dx + dy * dy;
    let t = lengthSq === 0 ? 0 : ((px - x1) * dx + (py - y1) * dy) / lengthSq;
    t = Math.max(0, Math.min(1, t));
    const cx = x1 + t * dx;
    const cy = y1 + t * dy;
    return Math.hypot(px - cx, py - cy);
}

function inRoundedRect(px, py, x, y, size, radius) {
    if (px < x || px > x + size || py < y || py > y + size) return false;
    const nx = Math.min(px - x, x + size - px);
    const ny = Math.min(py - y, y + size - py);
    if (nx >= radius || ny >= radius) return true;
    return Math.hypot(radius - nx, radius - ny) <= radius;
}

function mix(base, color, alpha) {
    return [
        base[0] + (color[0] - base[0]) * alpha,
        base[1] + (color[1] - base[1]) * alpha,
        base[2] + (color[2] - base[2]) * alpha
    ];
}

function samplePixel(px, py) {
    // 배경: 대각선 그라데이션
    const t = (px / WIDTH + py / HEIGHT) / 2;
    let color = mix(COLOR_START, COLOR_END, t);

    // 로고 타일: 밝은 반투명 판 + 말풍선 + N
    if (inRoundedRect(px, py, TILE.x, TILE.y, TILE.size, TILE_RADIUS)) {
        color = mix(color, WHITE, 0.14);
        for (const bubble of BUBBLES) {
            const cx = TILE.x + bubble.cx * TILE_SCALE;
            const cy = TILE.y + bubble.cy * TILE_SCALE;
            if (Math.hypot(px - cx, py - cy) <= bubble.r * TILE_SCALE) {
                color = mix(color, bubble.color, bubble.alpha);
            }
        }
        if (TILE_N.some(seg => distToSegment(px, py, seg) <= TILE_N_HALF_STROKE)) {
            color = WHITE;
        }
    }

    // 워드마크
    if (px >= 480 && WORDMARK.some(seg => distToSegment(px, py, seg) <= WORDMARK_HALF_STROKE)) {
        color = WHITE;
    }
    return color;
}

function render() {
    const row = WIDTH * 3 + 1;
    const raw = Buffer.alloc(row * HEIGHT);
    const step = 1 / SAMPLES;
    for (let y = 0; y < HEIGHT; y++) {
        raw[y * row] = 0; // 필터 없음
        for (let x = 0; x < WIDTH; x++) {
            let r = 0, g = 0, b = 0;
            for (let sy = 0; sy < SAMPLES; sy++) {
                for (let sx = 0; sx < SAMPLES; sx++) {
                    const c = samplePixel(x + (sx + 0.5) * step, y + (sy + 0.5) * step);
                    r += c[0]; g += c[1]; b += c[2];
                }
            }
            const n = SAMPLES * SAMPLES;
            const offset = y * row + 1 + x * 3;
            raw[offset] = Math.round(r / n);
            raw[offset + 1] = Math.round(g / n);
            raw[offset + 2] = Math.round(b / n);
        }
    }
    return raw;
}

// ---- PNG 인코딩 ----

const CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        table[n] = c >>> 0;
    }
    return table;
})();

function crc32(buffer) {
    let c = 0xffffffff;
    for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
    const typeBuf = Buffer.from(type, 'ascii');
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
    return Buffer.concat([length, typeBuf, data, crc]);
}

function encodePng(raw) {
    const header = Buffer.alloc(13);
    header.writeUInt32BE(WIDTH, 0);
    header.writeUInt32BE(HEIGHT, 4);
    header[8] = 8; // 비트 깊이
    header[9] = 2; // RGB
    return Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        chunk('IHDR', header),
        chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
        chunk('IEND', Buffer.alloc(0))
    ]);
}

const output = path.join(__dirname, '..', 'public', 'images', 'og-default.png');
fs.writeFileSync(output, encodePng(render()));
console.log(`생성 완료: ${output}`);
