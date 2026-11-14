from PIL import Image
import numpy as np

c1 = Image.open('public/map_crop1.png').convert('L')
c2 = Image.open('public/map_crop2.png').convert('L')

a1 = np.array(c1)[50:200, 20:120]

best_dx, best_dy, min_diff = 0, 0, 1e9

for dy in range(-10, 11):
    for dx in range(-10, 11):
        a2 = np.array(c2)[50+dy:200+dy, 20+dx:120+dx]
        d = np.mean(np.abs(a1.astype(float) - a2.astype(float)))
        if d < min_diff:
            min_diff = d
            best_dx = dx
            best_dy = dy

print(f'Best offset: dx={best_dx}, dy={best_dy}, min_diff={min_diff}')
