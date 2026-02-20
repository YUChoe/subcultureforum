const fs = require('fs');
const path = require('path');

// 간단한 16x16 ICO 파일 생성 (N 이니셜)
// ICO 파일 헤더 + 16x16 비트맵
function generateSimpleICO() {
    // ICO 헤더 (6 bytes)
    const header = Buffer.from([
        0x00, 0x00, // Reserved
        0x01, 0x00, // Type (1 = ICO)
        0x01, 0x00  // Number of images
    ]);

    // Image directory entry (16 bytes)
    const dirEntry = Buffer.from([
        0x10,       // Width (16)
        0x10,       // Height (16)
        0x00,       // Color palette
        0x00,       // Reserved
        0x01, 0x00, // Color planes
        0x20, 0x00, // Bits per pixel (32)
        0x00, 0x04, 0x00, 0x00, // Image size (1024 bytes)
        0x16, 0x00, 0x00, 0x00  // Image offset (22 bytes)
    ]);

    // BMP 헤더 (40 bytes)
    const bmpHeader = Buffer.from([
        0x28, 0x00, 0x00, 0x00, // Header size
        0x10, 0x00, 0x00, 0x00, // Width
        0x20, 0x00, 0x00, 0x00, // Height (doubled for ICO)
        0x01, 0x00,             // Planes
        0x20, 0x00,             // Bits per pixel
        0x00, 0x00, 0x00, 0x00, // Compression
        0x00, 0x04, 0x00, 0x00, // Image size
        0x00, 0x00, 0x00, 0x00, // X pixels per meter
        0x00, 0x00, 0x00, 0x00, // Y pixels per meter
        0x00, 0x00, 0x00, 0x00, // Colors used
        0x00, 0x00, 0x00, 0x00  // Important colors
    ]);

    // 16x16 픽셀 데이터 (BGRA 형식)
    // 보라색 배경에 흰색 N
    const pixels = Buffer.alloc(16 * 16 * 4);
    
    // N 패턴 + 노란색 말풍선 (포럼/커뮤니티 상징) - 더 크게, 알파 낮춤
    const nPattern = [
        [0,2,2,2,2,0,0,0,0,0,2,2,2,0,0,0], // 말풍선 더 크게
        [0,2,2,2,2,0,0,0,0,0,2,2,2,0,0,0],
        [0,2,2,2,2,0,0,0,0,0,2,2,2,0,0,0],
        [0,0,2,2,0,0,0,0,0,0,0,2,0,0,0,0],
        [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
        [0,0,1,1,1,0,0,0,0,0,1,1,1,0,0,0], // N 조금 크게
        [0,0,1,1,1,0,0,0,0,0,1,1,1,0,0,0],
        [0,0,1,1,1,1,0,0,0,0,1,1,1,0,0,0],
        [0,0,1,1,0,1,1,0,0,0,1,1,1,0,0,0],
        [0,0,1,1,0,0,1,1,0,0,1,1,1,0,0,0],
        [0,0,1,1,0,0,0,1,1,0,1,1,1,0,0,0],
        [0,0,1,1,0,0,0,0,1,1,1,1,1,0,0,0],
        [0,0,1,1,0,0,0,0,0,1,1,1,1,0,0,0],
        [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
        [2,2,2,0,0,0,0,0,0,0,0,0,0,0,0,0], // 말풍선 더 크게
        [2,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0]
    ];

    // 보라색 배경 (667eea)
    const bgColor = { b: 0xea, g: 0x7e, r: 0x66, a: 0xff };
    // 흰색 글자 (N)
    const fgColor = { b: 0xff, g: 0xff, r: 0xff, a: 0xff };
    // 노란색 말풍선 (FFD700) - 알파 낮춤 (0xb0 = 약 70%)
    const bubbleColor = { b: 0x00, g: 0xd7, r: 0xff, a: 0xb0 };

    // 아래에서 위로 (BMP는 bottom-up)
    for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
            const idx = ((15 - y) * 16 + x) * 4;
            let color;
            if (nPattern[y][x] === 1) {
                color = fgColor; // N 글자
            } else if (nPattern[y][x] === 2) {
                color = bubbleColor; // 말풍선
            } else {
                color = bgColor; // 배경
            }
            pixels[idx] = color.b;
            pixels[idx + 1] = color.g;
            pixels[idx + 2] = color.r;
            pixels[idx + 3] = color.a;
        }
    }

    // AND 마스크 (투명도, 모두 불투명)
    const andMask = Buffer.alloc(16 * 16 / 8);

    // 모든 버퍼 결합
    const ico = Buffer.concat([header, dirEntry, bmpHeader, pixels, andMask]);

    return ico;
}

// 파비콘 생성
const icoData = generateSimpleICO();
const outputPath = path.join(__dirname, '../public/favicon.ico');
fs.writeFileSync(outputPath, icoData);

console.log('✓ favicon.ico 생성 완료');
console.log(`  위치: ${outputPath}`);
console.log('  크기: 16x16 픽셀');
console.log('  디자인: 보라색 배경 + 흰색 N (조금 크게) + 노란색 말풍선 (더 크게, 알파 70%)');
