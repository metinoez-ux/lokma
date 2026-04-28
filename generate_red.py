from PIL import Image

# Create a 1000x1000 image with color #E9021F (RGB: 233, 2, 31)
img = Image.new('RGB', (1000, 1000), color=(233, 2, 31))
img.save('mobile_app/assets/images/solid_red.png')
print("Created solid_red.png with #E9021F")
