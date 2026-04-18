with open('mobile_app/lib/screens/marketplace/kasap/business_detail_screen.dart', 'r') as f:
    text = f.read()
if "hasTunaTag" in text:
    print("still has it!")
else:
    print("clean!")
