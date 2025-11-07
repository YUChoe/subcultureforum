const fs = require('fs');
const path = require('path');

// 간단한 PNG 이미지 데이터 (1x1 픽셀 빨간색)
const pngData = Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG 시그니처
    0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR 청크 시작
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // 1x1 픽셀
    0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, // 색상 타입 등
    0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41, // IDAT 청크 시작
    0x54, 0x08, 0xD7, 0x63, 0xF8, 0x0F, 0x00, 0x00, // 빨간색 픽셀 데이터
    0x01, 0x00, 0x01, 0x5C, 0xC2, 0xD2, 0x3D, 0x00, // 체크섬
    0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, // IEND 청크
    0x42, 0x60, 0x82
]);

// 더 큰 테스트 이미지 (100x100 픽셀 파란색)
function createLargerTestImage() {
    // 간단한 BMP 헤더 생성 (100x100 픽셀, 24비트 색상)
    const width = 100;
    const height = 100;
    const bytesPerPixel = 3;
    const rowSize = Math.ceil((width * bytesPerPixel) / 4) * 4; // 4바이트 정렬
    const pixelDataSize = rowSize * height;
    const fileSize = 54 + pixelDataSize; // BMP 헤더 54바이트 + 픽셀 데이터

    const bmpHeader = Buffer.alloc(54);

    // BMP 파일 헤더
    bmpHeader.write('BM', 0); // 시그니처
    bmpHeader.writeUInt32LE(fileSize, 2); // 파일 크기
    bmpHeader.writeUInt32LE(54, 10); // 픽셀 데이터 오프셋

    // DIB 헤더
    bmpHeader.writeUInt32LE(40, 14); // DIB 헤더 크기
    bmpHeader.writeInt32LE(width, 18); // 너비
    bmpHeader.writeInt32LE(height, 22); // 높이
    bmpHeader.writeUInt16LE(1, 26); // 색상 평면 수
    bmpHeader.writeUInt16LE(24, 28); // 비트 수
    bmpHeader.writeUInt32LE(pixelDataSize, 34); // 이미지 크기

    // 픽셀 데이터 (파란색)
    const pixelData = Buffer.alloc(pixelDataSize);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const offset = y * rowSize + x * bytesPerPixel;
            pixelData[offset] = 255;     // Blue
            pixelData[offset + 1] = 0;   // Green
            pixelData[offset + 2] = 0;   // Red
        }
    }

    return Buffer.concat([bmpHeader, pixelData]);
}

// 테스트 이미지들 생성
const testImagesDir = path.join(__dirname, 'test_images');

// 디렉토리가 없으면 생성
if (!fs.existsSync(testImagesDir)) {
    fs.mkdirSync(testImagesDir, { recursive: true });
}

// 1. 작은 PNG 이미지
fs.writeFileSync(path.join(testImagesDir, 'test_small.png'), pngData);
console.log('작은 PNG 이미지 생성 완료: test_small.png');

// 2. 큰 BMP 이미지
const largeBmpData = createLargerTestImage();
fs.writeFileSync(path.join(testImagesDir, 'test_large.bmp'), largeBmpData);
console.log('큰 BMP 이미지 생성 완료: test_large.bmp');

// 3. JPEG 형태의 테스트 파일 (실제로는 텍스트)
const fakeJpegData = Buffer.from([
    0xFF, 0xD8, 0xFF, 0xE0, // JPEG 시그니처
    0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, // JFIF 헤더
    0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00,
    0xFF, 0xD9 // JPEG 종료 마커
]);
fs.writeFileSync(path.join(testImagesDir, 'test_fake.jpg'), fakeJpegData);
console.log('가짜 JPEG 이미지 생성 완료: test_fake.jpg');

console.log('\n테스트 이미지 파일들이 test_images/ 디렉토리에 생성되었습니다.');
console.log('파일 목록:');
fs.readdirSync(testImagesDir).forEach(file => {
    const filePath = path.join(testImagesDir, file);
    const stats = fs.statSync(filePath);
    console.log(`- ${file} (${stats.size} bytes)`);
});