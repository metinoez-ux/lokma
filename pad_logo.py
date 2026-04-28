from PIL import Image
import os

def pad_image(input_path, output_path, bg_color):
    try:
        # Open the original logo
        img = Image.open(input_path).convert("RGBA")
        
        # We want to create an 1152x1152 image for Android 12
        # The inner safe zone is a circle of diameter 768.
        # So we should scale our logo so its width is at most 700 to be safe.
        target_width = 700
        
        # Calculate new height to maintain aspect ratio
        w_percent = (target_width / float(img.size[0]))
        target_height = int((float(img.size[1]) * float(w_percent)))
        
        # Resize image using LANCZOS
        img = img.resize((target_width, target_height), Image.Resampling.LANCZOS)
        
        # Create a new background image with E9021F
        bg = Image.new('RGBA', (1152, 1152), bg_color)
        
        # Calculate center position
        offset = ((1152 - target_width) // 2, (1152 - target_height) // 2)
        
        # Paste the resized logo onto the background, using its alpha channel as mask
        bg.paste(img, offset, img)
        
        # Save the result
        bg.save(output_path)
        print(f"Successfully created {output_path}")
    except Exception as e:
        print(f"Error: {e}")

# Create padded whole logo
pad_image('mobile_app/assets/images/lokma_splash_whole.png', 'mobile_app/assets/images/lokma_android12_splash_whole.png', (233, 2, 31, 255))

# Create padded bitten logo
if os.path.exists('mobile_app/assets/images/lokma_splash_bitten.png'):
    pad_image('mobile_app/assets/images/lokma_splash_bitten.png', 'mobile_app/assets/images/lokma_android12_splash_bitten.png', (233, 2, 31, 255))
