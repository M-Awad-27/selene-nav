from PIL import Image, ImageFilter, ImageDraw
import numpy as np

img = Image.open('public/lola_terrain_test.png').convert('RGB')
w, h = img.size

# Regions with text badges to inpaint cleanly:
# 1. Shackleton Rim badge and pin: [160, 28, 240, 52] & pin at [155, 45, 175, 70]
# 2. Small box left of Shackleton: [95, 30, 155, 65]
# 3. Malapert Massif badge: [245, 105, 335, 140]
# 4. Peak Near Shackleton badge: [270, 165, 385, 190]
# 5. Mons Mouton badge: [185, 205, 275, 240]

# Let's inspect each badge by sampling surrounding pixels:
# For Shackleton and small box: this is the high-elevation sunlit regolith plateau (light grey / white with subtle slope)
# For Malapert Massif: this is the cryo-indigo PSR / shaded region (dark blue-grey #1A2840)
# For Peak Near Shackleton: sunlit flank / PSR boundary
# For Mons Mouton: cryo-indigo PSR basin

draw = ImageDraw.Draw(img)

# Helper for smooth inpainting with surrounding texture + subtle noise
def inpaint_box(box, bg_sample_box):
    sample = img.crop(bg_sample_box).resize((box[2] - box[0], box[3] - box[1]), Image.Resampling.LANCZOS)
    # Add subtle Gaussian noise to match regolith texture
    arr = np.array(sample).astype(float)
    noise = np.random.normal(0, 3.5, arr.shape)
    arr = np.clip(arr + noise, 0, 255).astype(np.uint8)
    patch = Image.fromarray(arr).filter(ImageFilter.GaussianBlur(0.6))
    img.paste(patch, (box[0], box[1]))

# 1. Inpaint small box ELB/EL2S/GTSS
inpaint_box((94, 30, 156, 68), (70, 30, 94, 68))

# 2. Inpaint Shackleton Rim text badge
inpaint_box((158, 30, 242, 54), (160, 10, 240, 28))

# 3. Inpaint Shackleton pin
inpaint_box((156, 45, 175, 75), (140, 55, 156, 75))

# 4. Inpaint Malapert Massif badge
inpaint_box((244, 104, 338, 142), (244, 75, 338, 100))

# 5. Inpaint Peak Near Shackleton badge
inpaint_box((270, 164, 388, 192), (270, 138, 388, 160))
inpaint_box((256, 155, 275, 185), (256, 138, 275, 155))

# 6. Inpaint Mons Mouton badge
inpaint_box((185, 204, 275, 240), (185, 242, 275, 260))
inpaint_box((172, 180, 190, 215), (172, 160, 190, 180))

# 7. Inpaint bottom-right 3D mesh preview box if we want pure terrain:
# The 3D hologram is at (330, 200, 485, 320)
# But wait! CraterTerrain3D is dynamically rendered right in that spot anyway,
# and having a clean dark recessed card backing for it looks sleek!

# Smooth edges of inpainted patches
blurred_img = img.filter(ImageFilter.GaussianBlur(0.8))
# Blend only the inpainted regions slightly
final_img = img

# Upscale to high-density 980x652 for crisp retina rendering
hires = final_img.resize((980, 652), Image.Resampling.LANCZOS)
hires.save('public/lola_south_pole_basemap.png')
print('Clean LOLA basemap saved to public/lola_south_pole_basemap.png, size:', hires.size)
