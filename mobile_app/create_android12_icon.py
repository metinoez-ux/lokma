from PIL import Image

# Open the icon (bitten O)
img = Image.open('assets/images/lokma_icon_o.png')

# Resize it to 650x650 so it fits well within the 768px safe circle of Android 12
img = img.resize((650, 650), Image.Resampling.LANCZOS)

# Create a transparent 1152x1152 background
bg = Image.new('RGBA', (1152, 1152), (0, 0, 0, 0))

# Paste the icon into the center
x = (1152 - 650) // 2
y = (1152 - 650) // 2
bg.paste(img, (x, y), img)

# Save
bg.save('assets/images/lokma_android12_splash_icon.png')
print("Created assets/images/lokma_android12_splash_icon.png")
