# MOD09GA Processing Flow

```mermaid
flowchart TD
  A(["MOD09GA / MYD09GA scenes"]) --> B["QA filter<br/>clear sky & low SZA"]
  B --> C["Topographic correction<br/>(slope, aspect)"]
  C --> D{shadow?}
  D -->|yes| M["shadow_mask = 1"]
  D -->|no| E
  C --> M
  B --> N["saturation check"]
  N --> P["sat_vis mask"]
  E["Anisotropy correction<br/>BRDF snow/ice"] --> F["Narrow-band albedo"]
  F --> G["Broadband conversion"]
  G --> H["Snow / Ice classify"]
  H --> I["Broadband albedo"]
  I --> J["Gap-fill<br/>2-pass 3×3"]
  J --> K["Composites<br/>half-month / season / year"]
  P --> K
  M --> K
```

```  
(GitHub, GitLab, VS Code and many markdown renderers display Mermaid automatically.)

────────────────────────────────────────
2. Export a static SVG/PNG
• Copy the code block above.  
• Go to https://mermaid.live, paste, and click **Download → SVG** or **PNG**.  
• Save the file as `docs/processing_flow.svg` and commit it.

────────────────────────────────────────
3. Embed directly in your manuscript
If the journal accepts SVG/PNG, use method 2 and upload the graphic.  
If it accepts raw Mermaid, paste the block (some online journals now support it).

That’s all—you decide which storage form fits your workflow best.