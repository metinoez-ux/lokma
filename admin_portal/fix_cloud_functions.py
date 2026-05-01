import re

files_to_fix = [
    "functions/src/index.ts",
    "functions/src/kermesCustomerNotifications.ts"
]

for file in files_to_fix:
    with open(file, "r") as f:
        content = f.read()
    
    # Replace the podImageUrl assignment
    content = content.replace("after.podImageUrl || after.deliveryProofUrl || null", "(after.deliveryProof && after.deliveryProof.photoUrl) || after.podImageUrl || after.deliveryProofUrl || null")
    
    with open(file, "w") as f:
        f.write(content)

