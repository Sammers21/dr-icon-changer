// Script to generate Tauri icons from app-logo.png
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const pngToIco = require('png-to-ico').default || require('png-to-ico');

const inputPath = path.join(__dirname, '../src/assets/app-logo.png');
const outputDir = path.join(__dirname, '../src-tauri/icons');

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

const sizes = [
    { name: '32x32.png', size: 32 },
    { name: '128x128.png', size: 128 },
    { name: '128x128@2x.png', size: 256 },
    { name: 'icon.png', size: 512 },
    { name: 'Square30x30Logo.png', size: 30 },
    { name: 'Square44x44Logo.png', size: 44 },
    { name: 'Square71x71Logo.png', size: 71 },
    { name: 'Square89x89Logo.png', size: 89 },
    { name: 'Square107x107Logo.png', size: 107 },
    { name: 'Square142x142Logo.png', size: 142 },
    { name: 'Square150x150Logo.png', size: 150 },
    { name: 'Square284x284Logo.png', size: 284 },
    { name: 'Square310x310Logo.png', size: 310 },
    { name: 'StoreLogo.png', size: 50 },
];

async function generateIcons() {
    console.log('Generating icons from app-logo.png...');

    for (const { name, size } of sizes) {
        const outputPath = path.join(outputDir, name);
        await sharp(inputPath)
            .resize(size, size)
            .png()
            .toFile(outputPath);
        console.log(`Generated: ${name} (${size}x${size})`);
    }

    // Generate ICO file (Windows) using png-to-ico
    const icoPath = path.join(outputDir, 'icon.ico');
    const iconPng = path.join(outputDir, 'icon.png');
    const icoBuffer = await pngToIco(iconPng);
    fs.writeFileSync(icoPath, icoBuffer);
    console.log('Generated: icon.ico');

    console.log('Icon generation complete!');
}

generateIcons().catch(console.error);
