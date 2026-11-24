const sharp = require('sharp');

module.exports = async ({ input, output, width }) => {
  const info = await sharp(input)
    .resize({ width, withoutEnlargement: true }) // never upscale
    .jpeg({ quality: 80 })
    .toFile(output);

  return { width: info.width, height: info.height, bytes: info.size };
};