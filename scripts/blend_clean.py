from PIL import Image
import numpy as np

c1 = Image.open('public/map_crop1.png').convert('RGB')
c2 = Image.open('public/map_crop2.png').convert('RGB')

# Start with c1 as the base
res = c1.copy()

# Regions in c1 that have badges/labels:
# Replace Malapert Massif badge in c1 with c2:
# In c1: Malapert Massif is at x: 240..340, y: 95..145
patch_malapert = c2.crop((240, 95, 340, 145))
res.paste(patch_malapert, (240, 95))

# Replace Mons Mouton badge in c1 with c2:
# In c1: Mons Mouton is at x: 180..275, y: 200..245
patch_mouton = c2.crop((180, 200, 275, 245))
res.paste(patch_mouton, (180, 200))

# Replace Peak Near Shackleton badge in c1 with c2:
# In c1: Peak Near Shackleton is at x: 255..390, y: 155..195
patch_peak = c2.crop((255, 155, 390, 195))
res.paste(patch_peak, (255, 155))

# Crop out header bar (y=0..24):
clean_map = res.crop((0, 24, 490, 350))
clean_map.save('public/clean_lola_basemap.png')
print('clean_lola_basemap.png saved!')
