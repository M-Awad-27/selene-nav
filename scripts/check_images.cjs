const fs = require('fs');
const files = [
  'public/lola_basemap_disc.png',
  'public/lola_south_pole_reference.png',
  'public/reference_lola_map.png',
  'public/reference_lola_map_1.png',
  'public/thumb_map.png'
];

files.forEach(f => {
  if (fs.existsSync(f)) {
    const b = fs.readFileSync(f);
    const width = b.readUInt32BE(16);
    const height = b.readUInt32BE(20);
    console.log(f, 'Size:', b.length, 'Resolution:', width + 'x' + height);
  } else {
    console.log(f, 'NOT FOUND');
  }
});
