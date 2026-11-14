from PIL import Image, ImageFilter
import numpy as np

# Load crop1 and crop2
c1 = Image.open('public/map_crop1.png').convert('RGB')
c2 = Image.open('public/map_crop2.png').convert('RGB')

w, h = c1.size

# We want to create a clean basemap 'public/lola_south_pole_basemap.png'
# First, crop off the top title bar from the image if present:
# In crop1, line 0-24 is "SOUTH POLE STEREOGRAPHIC MAP..."
# Let's inspect where the terrain starts:
# The header strip is roughly y=0 to y=26.
# Let's check exact header boundary:

a1 = np.array(c1)
a2 = np.array(c2)

print('Shape:', a1.shape)
# The header is dark #181B22 at the very top.
# Let's find y where terrain begins:
print('Row 0:', a1[0, 100])
print('Row 20:', a1[20, 100])
print('Row 30:', a1[30, 100])
