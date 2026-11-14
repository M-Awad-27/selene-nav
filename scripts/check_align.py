from PIL import Image
import numpy as np

c1 = Image.open('public/map_crop1.png').convert('RGB')
c2 = Image.open('public/map_crop2.png').convert('RGB')

# Let's check difference in regions that should be identical:
# Bottom-left corner (0..100, 250..350)
a1 = np.array(c1)
a2 = np.array(c2)

diff = np.abs(a1.astype(int) - a2.astype(int))
print('Mean diff in bottom-left corner:', diff[250:350, 0:100].mean())
print('Mean diff in top-left corner:', diff[25:100, 0:80].mean())
