with open("/Users/metinoz/.gemini/antigravity/brain/71bfedb4-dcdf-469d-b089-da0c26ac3bc9/.system_generated/logs/overview.txt", "r") as f:
    text = f.read()
    
if "✅ [DetailScreen]" in text:
    print("MATCH FOUND IN DETAIL SCREEN")
else:
    print("NO MATCH IN DETAIL SCREEN")
