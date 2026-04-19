import sys
from PIL import Image

def extract_white_text(input_path, output_path):
    print(f"Processing {input_path}...")
    img = Image.open(input_path).convert("RGBA")
    data = img.load()
    w, h = img.size
    
    for y in range(h):
        for x in range(w):
            r, g, b, a = data[x, y]
            if a == 0:
                continue
                
            # Whiteness indicator is the Green + Blue channels since Red is dominant in background
            avg = (g + b) / 2.0
            
            # Map avg (50 to 200) to alpha (0 to 255)
            # This perfectly preserves the anti-aliased edges of the white text
            if avg < 60:
                data[x, y] = (255, 255, 255, 0) # completely transparent
            elif avg > 220:
                data[x, y] = (r, g, b, a) # Keep originally white pixels
            else:
                # Interpolate alpha for smooth edges
                new_alpha = int((avg - 60) / (220 - 60) * 255)
                # Cap the alpha between 0 and 255
                new_alpha = max(0, min(255, new_alpha))
                # Base is white
                data[x, y] = (255, 255, 255, new_alpha)
                
    img.save(output_path)
    print(f"Saved to {output_path}!")

extract_white_text("lokma_splash_whole.png", "lokma_splash_whole_clean.png")
extract_white_text("lokma_splash_bitten.png", "lokma_splash_bitten_clean.png")
