from PIL import Image

im = Image.open('C:/Users/DELL/.gemini/antigravity/brain/f890773c-8a2f-4fd3-9f31-9d137dc78021/.user_uploaded/media_1794640504547_5007130f.jpg')

# 1. Top bar: (0, 0, 1024, 60)
top_bar = im.crop((0, 0, 1024, 60))
top_bar.save('public/ref_top_bar.png')

# 2. Right panel top (Panorama + Polar Radar): (504, 60, 1014, 275)
right_top = im.crop((504, 60, 1014, 275))
right_top.save('public/ref_right_top.png')

# 3. Solar mast + Telemetry cards: (504, 275, 1014, 385)
right_mid = im.crop((504, 275, 1014, 385))
right_mid.save('public/ref_right_mid.png')

# 4. Bottom Dock (Timeline + Diff Matrix): (0, 385, 1024, 571)
bottom_dock = im.crop((0, 385, 1024, 571))
bottom_dock.save('public/ref_bottom_dock.png')

print('Cropped all panels successfully!')
