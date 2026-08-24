# Theme Customization

## Theme mode

Switch between **Light** and **Dark** mode in **Settings → Appearance**. The preference is persisted per device in `localStorage`.

## Accent colors

Choose from 6 accent colors that control the primary UI color (buttons, active states, focus rings, sidebar highlights):

| Color | Description |
|---|---|
| **Blue** | Default — calm, professional |
| **Green** | Fresh, data-focused |
| **Purple** | Creative, distinctive |
| **Orange** | Warm, energetic |
| **Red** | Bold, attention-grabbing |
| **Pink** | Playful, modern |

The accent color overrides the following CSS variables:

- `--primary` / `--primary-foreground`
- `--ring`
- `--sidebar-primary` / `--sidebar-primary-foreground`
- `--sidebar-ring`
- `--chart-1`

## Persistence

Both theme mode and accent color are stored in `localStorage`:

- `datalook-theme` — `"dark"` or `"light"`
- `datalook-accent` — `"blue"`, `"green"`, `"purple"`, `"orange"`, `"red"`, `"pink"`

Settings are per-device and per-browser. They are not synced across devices.
