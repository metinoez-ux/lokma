with open("src/components/providers/AdminProvider.tsx", "r") as f:
    lines = f.readlines()

lines.insert(592, "  }\n")

with open("src/components/providers/AdminProvider.tsx", "w") as f:
    f.writelines(lines)
