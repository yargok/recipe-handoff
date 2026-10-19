function sniffImage(buf) {
  if (buf[0] === 0x89 && buf[1] === 0x50) return 'png';
  if (buf[0] === 0x47 && buf[1] === 0x49) return 'gif';
  if (buf[0] === 0x52 && buf[1] === 0x49) return 'webp';
  return 'jpg';
}

module.exports = { sniffImage };
