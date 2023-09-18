const sharp = require('sharp');
const got = require('got');
const fs = require('fs');

function resizeBuffer(inputBuffer, options = {}) {
  const { width, height, position, fit } = options;
  const quality = options.quality || 80;

  return sharp(inputBuffer)
    .resize({
      width, height, position, fit
    })
    .jpeg({ quality, progressive: true })
    .toFormat('jpeg')
    .toBuffer();
}

function downloadStreamResize(url, dest, options = {}) {
  if(process.env.SKIP_S3_IMAGES) {
    return Promise.resolve();
  }

  const { width, height, position, fit } = options;
  const quality = options.quality || 60;
  const outputStream = fs.createWriteStream(dest);

  const transform = sharp()
    .resize({ width, height, position, fit })
    .jpeg({ quality, progressive: true });

  got.stream(url, 
    { retry: 20 })
    .pipe(transform)
    .pipe(outputStream);

  return new Promise((resolve, reject) => {
    outputStream
      .on('finish', resolve)
      .on('error', reject);
  });
}

module.exports = {
  resizeBuffer,
  downloadStreamResize
};
