from PIL import Image
import numpy as np

c1 = Image.open('public/map_crop1.png').convert('RGB')
terrain = c1.crop((0, 24, 490, 350))
terrain.save('public/lola_terrain_test.png')
print('Terrain test saved, size:', terrain.size)
