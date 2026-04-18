import subprocess

try:
    with open('/Users/metinoz/Developer/LOKMA_MASTER/mobile_app/lib/screens/marketplace/widgets/wallet_business_card.dart', 'r') as f:
        content = f.read()
    
    if "Positioned(" in content:
        print("Success")

except Exception as e:
    print(e)
