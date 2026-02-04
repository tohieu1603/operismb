# Phase 01: Project Setup & Configuration

**Status:** Pending
**Estimated:** 2-3 hours

## Context

Initialize Next.js 15 admin dashboard as sibling project to operis-api. Use Ant Design as primary UI library with Tailwind for utility classes.

## Overview

- Create Next.js 15 project with App Router
- Install and configure dependencies
- Setup folder structure
- Configure environment variables
- Setup Tailwind + Ant Design integration

## Requirements

### Dependencies

```json
{
  "dependencies": {
    "antd": "^5.x",
    "@ant-design/icons": "^5.x",
    "@tanstack/react-query": "^5.x",
    "axios": "^1.x",
    "dayjs": "^1.x"
  },
  "devDependencies": {
    "tailwindcss": "^3.x",
    "postcss": "^8.x",
    "autoprefixer": "^10.x",
    "@types/node": "^20.x",
    "@types/react": "^18.x",
    "typescript": "^5.x"
  }
}
```

### Environment Variables

```env
# .env.local
NEXT_PUBLIC_API_URL=http://localhost:3025/api
```

## Implementation Steps

### 1. Create Next.js Project

```bash
cd /Users/admin
npx create-next-app@latest operis-admin --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
cd operis-admin
```

### 2. Install Dependencies

```bash
npm install antd @ant-design/icons @tanstack/react-query axios dayjs
```

### 3. Configure Tailwind (tailwind.config.ts)

```ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
  // Important: disable preflight to avoid conflicts with Ant Design
  corePlugins: {
    preflight: false,
  },
};
export default config;
```

### 4. Setup Ant Design Theme (src/lib/antd-theme.ts)

```ts
import type { ThemeConfig } from "antd";

export const theme: ThemeConfig = {
  token: {
    colorPrimary: "#1890ff",
    borderRadius: 6,
  },
};
```

### 5. Create Folder Structure

```
src/
├── app/
│   ├── (auth)/
│   │   └── login/
│   │       └── page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── users/
│   │   │   ├── page.tsx
│   │   │   └── [id]/
│   │   │       └── page.tsx
│   │   └── deposits/
│   │       └── page.tsx
│   ├── layout.tsx
│   └── providers.tsx
├── components/
│   ├── ui/
│   └── shared/
├── hooks/
│   └── queries/
├── lib/
│   ├── api.ts
│   └── antd-theme.ts
├── services/
│   ├── auth.service.ts
│   ├── user.service.ts
│   └── deposit.service.ts
└── types/
    ├── user.ts
    ├── deposit.ts
    └── api.ts
```

### 6. Root Layout with Providers (src/app/layout.tsx)

```tsx
import type { Metadata } from "next";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import Providers from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Operis Admin",
  description: "Admin Dashboard for Operis API",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <body>
        <AntdRegistry>
          <Providers>{children}</Providers>
        </AntdRegistry>
      </body>
    </html>
  );
}
```

### 7. Query Client Provider (src/app/providers.tsx)

```tsx
"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConfigProvider } from "antd";
import viVN from "antd/locale/vi_VN";
import { useState } from "react";
import { theme } from "@/lib/antd-theme";

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider theme={theme} locale={viVN}>
        {children}
      </ConfigProvider>
    </QueryClientProvider>
  );
}
```

### 8. Install Ant Design Next.js Registry

```bash
npm install @ant-design/nextjs-registry
```

## Todo List

- [ ] Create Next.js 15 project in /Users/admin/operis-admin
- [ ] Install core dependencies (antd, tanstack-query, axios)
- [ ] Install @ant-design/nextjs-registry for SSR support
- [ ] Configure Tailwind with preflight disabled
- [ ] Create folder structure
- [ ] Setup root layout with AntdRegistry
- [ ] Create providers.tsx with QueryClient and ConfigProvider
- [ ] Create .env.local with API_URL
- [ ] Create antd-theme.ts
- [ ] Verify dev server runs without errors

## Success Criteria

1. `npm run dev` starts without errors
2. Visit http://localhost:3000 shows Next.js page
3. Ant Design components render correctly
4. Tailwind utility classes work
5. No console errors related to SSR/hydration

## Notes

- Use @ant-design/nextjs-registry to handle Ant Design SSR properly
- Disable Tailwind preflight to avoid CSS conflicts with Ant Design
- Vietnamese locale (viVN) for Ant Design date pickers, etc.
