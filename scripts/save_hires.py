from PIL import Image

c2 = Image.open('public/map_crop2.png')
# Crop off the top header bar (y=0..24)
terrain2 = c2.crop((0, 24, 490, 350))
hires2 = terrain2.resize((980, 652), Image.Resampling.LANCZOS)
hires2.save('public/lola_map_shackleton_hires.png')

c1 = Image.open('public/map_crop1.png')
terrain1 = c1.crop((0, 24, 490, 350))
hires1 = terrain1.resize((980, 652), Image.Resampling.LANCZOS)
hires1.save('public/lola_map_malapert_hires.png')

print('Saved hires maps successfully!')
