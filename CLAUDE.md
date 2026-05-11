Proyecto: FardoDrops

Stack:

- Next.js 15
- Supabase
- Tailwind + shadcn
- Resend (emails)
- Cloudinary (imágenes)

Reglas:

- TypeScript estricto
- Server components por defecto
- Código limpio
- Respuestas sin explicación
- Estilos: usar Tailwind SIEMPRE. NUNCA usar `style={{ }}` en código nuevo ni existente. Para CSS variables del proyecto usar valores arbitrarios de Tailwind: `text-[var(--ink)]`, `bg-[var(--surface-2)]`, `border-[var(--line)]`, `text-[13px]`, etc. Para estilos condicionales usar template literals o `cn()`. Solo se permite `style={}` para valores verdaderamente dinámicos en runtime (ej: posición calculada con JS, transformaciones de zoom, gridTemplateColumns generados programáticamente).
