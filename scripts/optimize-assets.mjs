import sharp from 'sharp';

// Convert the supplied monochrome logo's white background to alpha, not a redraw.
const { data, info } = await sharp('assets/source/kedi-logo-original.jpg')
  .greyscale()
  .raw()
  .toBuffer({ resolveWithObject: true });
const rgba = Buffer.alloc(info.width * info.height * 4);
for (let pixel = 0; pixel < data.length; pixel++) {
  // Discard faint JPEG noise while retaining antialiasing along the black strokes.
  rgba[pixel * 4 + 3] = Math.round(
    255 * Math.max(0, Math.min(1, (240 - data[pixel]) / 224)),
  );
}
await sharp(rgba, {
  raw: { width: info.width, height: info.height, channels: 4 },
})
  .trim({ background: '#00000000', threshold: 10 })
  .extend({ top: 24, bottom: 24, left: 24, right: 24, background: '#00000000' })
  .png()
  .toFile('assets/source/kedi-logo.png');

const widths = {
  istanbul: 1660,
  cat: 320,
  harness: 1000,
  ferry: 900,
  'kedi-logo': 256,
};
for (const [name, width] of Object.entries(widths)) {
  await sharp(`assets/source/${name}.png`)
    .resize({ width, withoutEnlargement: true })
    .webp({ quality: 90 })
    .toFile(`public/assets/${name}.webp`);
}

await sharp('assets/source/kedi-logo.png')
  .flatten({ background: '#f5f6f2' })
  .resize(64, 64, { fit: 'contain', background: '#f5f6f2' })
  .webp({ lossless: true })
  .toFile('public/assets/kedi-favicon.webp');

for (const name of ['team-mert', 'team-yigit']) {
  await sharp(`assets/source/${name}.png`)
    .resize(256, 256, {
      fit: 'contain',
      background: '#00000000',
      kernel: 'nearest',
    })
    .webp({ lossless: true })
    .toFile(`public/assets/${name}.webp`);
}
