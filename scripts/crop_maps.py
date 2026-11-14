from PIL import Image

im1 = Image.open('C:/Users/DELL/.gemini/antigravity/brain/f890773c-8a2f-4fd3-9f31-9d137dc78021/.user_uploaded/media_1794639853911_2a9b7acd.jpg')
im2 = Image.open('C:/Users/DELL/.gemini/antigravity/brain/f890773c-8a2f-4fd3-9f31-9d137dc78021/.user_uploaded/media_1794640504547_5007130f.jpg')

print('im1 size:', im1.size)
print('im2 size:', im2.size)

# Left panel bounding box in 1024x572:
# X is approximately from 12 to 500, Y is from 62 to 408
crop1 = im1.crop((12, 60, 502, 412))
crop1.save('public/map_crop1.png')

crop2 = im2.crop((12, 60, 502, 412))
crop2.save('public/map_crop2.png')

print('Saved map_crop1.png and map_crop2.png with size:', crop1.size)
