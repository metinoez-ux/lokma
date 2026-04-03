import re

with open('admin_portal/src/app/[locale]/admin/kermes/[id]/page.tsx') as f:
    text = f.read()

text = re.sub(
    r'setCategories\(\[\.\.\.DEFAULT_CATEGORIES, \.\.\.data\.customCategories\.filter\(c => !\DEFAULT_CATEGORIES\.includes\(c\)\)\]\);',
    r'const localizedCustomCats = data.customCategories.map((c: any) => typeof c === "object" ? getLocalizedText(c, locale) : String(c));\n        setCategories(prev => {\n          const merged = [...prev];\n          localizedCustomCats.forEach((c: string) => {\n            if (!merged.includes(c)) merged.push(c);\n          });\n          return merged;\n        });',
    text
)

text = re.sub(
    r'\}, \[kermesId, router\]\);',
    r'}, [kermesId, router, locale]);',
    text
)

text = re.sub(
    r'const firebaseCats = snapshot\.docs\.map\(d => d\.data\(\)\.name as string\);',
    r'const firebaseCats = snapshot.docs.map(d => {\n        const name = d.data().name;\n        return typeof name === "object" ? getLocalizedText(name, locale) : String(name || "");\n      });',
    text
)

text = re.sub(
    r'setCategories\(allCats\);',
    r'setCategories(prev => {\n        const cats = [...prev];\n        allCats.forEach(c => { if (!cats.includes(c)) cats.push(c); });\n        return cats;\n      });',
    text
)

text = re.sub(
    r'console\.error\(\'Error loading categories:\', error\);\n {7}\}\n  \}, \[\]\);',
    r'console.error(\'Error loading categories:\', error);\n      }\n  }, [locale]);',
    text
)

with open('admin_portal/src/app/[locale]/admin/kermes/[id]/page.tsx', 'w') as f:
    f.write(text)
