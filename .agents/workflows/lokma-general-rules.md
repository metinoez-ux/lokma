---
description: General LOKMA project rules - i18n, Theme, Tablet Responsiveness
---
# LOKMA Admin Portal - General Rules and Considerations

When working on the LOKMA Administrator Portal or LOKMA Customer Applications, you **MUST** ensure the following rules are strictly followed on every single edit, feature creation, or component update:

1. **i18n Compatibility (Internationalization)**: 
   - Every text rendered in the UI must be translated using the project's i18n configuration (`next-intl` with `t('key')` or similar).
   - Do NOT hardcode strings in the UI. Always define translations in the corresponding language files (e.g. `tr.json`, `en.json`, `de.json`).

2. **Theme Awareness (Light/Dark Mode)**:
   - Always ensure components support both Light Mode and Dark Mode.
   - Use Tailwind CSS `dark:` pseudo-classes consistently (e.g., `bg-white dark:bg-gray-800 text-black dark:text-white`).
   - Do not use hardcoded colors that break contrast in Dark Mode. Instead, rely on Shadcn/Radix UI CSS variables (e.g., `bg-background`, `text-foreground`, `border-border`) wherever available.

3. **11" Tablet Format Responsiveness**:
   - The Admin Panel is primarily used on 11" iPads/Tablets. 
   - The UI must look perfect and function smoothly on this form factor (around 1194x834 or 1024x768 resolution).
   - Do not design exclusively for massive 4K desktop screens or tiny 320px mobile screens without testing how it collapses or expands for 11" tablets.
   - Ensure touch targets and fonts are legible for tablet use.
