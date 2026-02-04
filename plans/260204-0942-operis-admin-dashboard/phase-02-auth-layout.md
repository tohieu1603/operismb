# Phase 02: Authentication & Admin Layout

**Status:** Pending
**Estimated:** 4-5 hours
**Depends on:** Phase 01

## Context

Implement authentication flow and admin layout shell. Backend uses JWT with access/refresh tokens. Admin dashboard requires `admin` role.

## Overview

- API client with axios interceptors
- Auth service (login, logout, refresh)
- Auth context/provider with token management
- Login page with Ant Design Form
- AdminLayout (Sider, Header, Content)
- Protected route middleware

## Requirements

### API Endpoints Used

```
POST /auth/login     - { email, password } -> { accessToken, refreshToken, user }
POST /auth/refresh   - { refreshToken } -> { accessToken, refreshToken }
POST /auth/logout    - {} -> { success }
GET  /auth/me        - {} -> User
```

### Token Storage

- accessToken: memory (React state)
- refreshToken: localStorage (for persistence)

## Implementation Steps

### 1. Types (src/types/auth.ts)

```ts
export interface User {
  id: string;
  email: string;
  name: string;
  role: "user" | "admin";
  tokenBalance: number;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: User;
}

export interface LoginCredentials {
  email: string;
  password: string;
}
```

### 2. API Client (src/lib/api.ts)

```ts
import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3025/api";

export const api = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
});

let accessToken: string | null = null;

export const setAccessToken = (token: string | null) => {
  accessToken = token;
};

export const getAccessToken = () => accessToken;

// Request interceptor - add auth header
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

// Response interceptor - handle 401, refresh token
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      const refreshToken = localStorage.getItem("refreshToken");
      if (refreshToken) {
        try {
          const { data } = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
          setAccessToken(data.accessToken);
          localStorage.setItem("refreshToken", data.refreshToken);
          originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
          return api(originalRequest);
        } catch {
          localStorage.removeItem("refreshToken");
          window.location.href = "/login";
        }
      }
    }
    return Promise.reject(error);
  }
);
```

### 3. Auth Service (src/services/auth.service.ts)

```ts
import { api, setAccessToken } from "@/lib/api";
import { AuthResponse, LoginCredentials, User } from "@/types/auth";

export const authService = {
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const { data } = await api.post<AuthResponse>("/auth/login", credentials);
    setAccessToken(data.accessToken);
    localStorage.setItem("refreshToken", data.refreshToken);
    return data;
  },

  async logout(): Promise<void> {
    const refreshToken = localStorage.getItem("refreshToken");
    try {
      await api.post("/auth/logout", { refreshToken });
    } finally {
      setAccessToken(null);
      localStorage.removeItem("refreshToken");
    }
  },

  async getMe(): Promise<User> {
    const { data } = await api.get<User>("/auth/me");
    return data;
  },

  async refreshToken(): Promise<AuthResponse> {
    const refreshToken = localStorage.getItem("refreshToken");
    if (!refreshToken) throw new Error("No refresh token");
    const { data } = await api.post<AuthResponse>("/auth/refresh", { refreshToken });
    setAccessToken(data.accessToken);
    localStorage.setItem("refreshToken", data.refreshToken);
    return data;
  },
};
```

### 4. Auth Context (src/lib/auth-context.tsx)

```tsx
"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { User, LoginCredentials } from "@/types/auth";
import { authService } from "@/services/auth.service";
import { setAccessToken } from "@/lib/api";
import { message } from "antd";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const init = async () => {
      const refreshToken = localStorage.getItem("refreshToken");
      if (refreshToken) {
        try {
          const authData = await authService.refreshToken();
          if (authData.user.role !== "admin") {
            throw new Error("Admin only");
          }
          setUser(authData.user);
        } catch {
          localStorage.removeItem("refreshToken");
        }
      }
      setIsLoading(false);
    };
    init();
  }, []);

  const login = async (credentials: LoginCredentials) => {
    const authData = await authService.login(credentials);
    if (authData.user.role !== "admin") {
      await authService.logout();
      throw new Error("Bạn không có quyền truy cập Admin Dashboard");
    }
    setUser(authData.user);
    router.push("/");
  };

  const logout = async () => {
    await authService.logout();
    setUser(null);
    router.push("/login");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};
```

### 5. Login Page (src/app/(auth)/login/page.tsx)

```tsx
"use client";

import { Form, Input, Button, Card, Typography, message } from "antd";
import { UserOutlined, LockOutlined } from "@ant-design/icons";
import { useAuth } from "@/lib/auth-context";
import { useState } from "react";

const { Title } = Typography;

export default function LoginPage() {
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);

  const onFinish = async (values: { email: string; password: string }) => {
    setLoading(true);
    try {
      await login(values);
      message.success("Đăng nhập thành công");
    } catch (error: any) {
      message.error(error.response?.data?.error || error.message || "Đăng nhập thất bại");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <Card className="w-full max-w-md">
        <Title level={3} className="text-center mb-6">
          Operis Admin
        </Title>
        <Form name="login" onFinish={onFinish} layout="vertical">
          <Form.Item
            name="email"
            rules={[
              { required: true, message: "Vui lòng nhập email" },
              { type: "email", message: "Email không hợp lệ" },
            ]}
          >
            <Input prefix={<UserOutlined />} placeholder="Email" size="large" />
          </Form.Item>
          <Form.Item
            name="password"
            rules={[{ required: true, message: "Vui lòng nhập mật khẩu" }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="Mật khẩu"
              size="large"
            />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block size="large">
              Đăng nhập
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
```

### 6. Admin Layout (src/app/(dashboard)/layout.tsx)

```tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Layout, Menu, Spin, Avatar, Dropdown, Typography } from "antd";
import {
  DashboardOutlined,
  UserOutlined,
  WalletOutlined,
  SettingOutlined,
  LogoutOutlined,
} from "@ant-design/icons";
import { useAuth } from "@/lib/auth-context";
import Link from "next/link";
import { usePathname } from "next/navigation";

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

const menuItems = [
  { key: "/", icon: <DashboardOutlined />, label: <Link href="/">Dashboard</Link> },
  { key: "/users", icon: <UserOutlined />, label: <Link href="/users">Users</Link> },
  { key: "/deposits", icon: <WalletOutlined />, label: <Link href="/deposits">Deposits</Link> },
  { key: "/settings", icon: <SettingOutlined />, label: <Link href="/settings">Settings</Link> },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading, isAuthenticated, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spin size="large" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  const userMenu = [
    { key: "profile", label: user?.email },
    { type: "divider" as const },
    { key: "logout", icon: <LogoutOutlined />, label: "Đăng xuất", onClick: logout },
  ];

  return (
    <Layout className="min-h-screen">
      <Sider theme="dark" width={220}>
        <div className="h-16 flex items-center justify-center">
          <Text strong className="text-white text-lg">Operis Admin</Text>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[pathname]}
          items={menuItems}
        />
      </Sider>
      <Layout>
        <Header className="bg-white px-4 flex items-center justify-end shadow-sm">
          <Dropdown menu={{ items: userMenu }} placement="bottomRight">
            <div className="flex items-center gap-2 cursor-pointer">
              <Avatar icon={<UserOutlined />} />
              <Text>{user?.name}</Text>
            </div>
          </Dropdown>
        </Header>
        <Content className="m-4 p-6 bg-white rounded-lg min-h-[280px]">
          {children}
        </Content>
      </Layout>
    </Layout>
  );
}
```

### 7. Update Providers (src/app/providers.tsx)

```tsx
"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConfigProvider, App } from "antd";
import viVN from "antd/locale/vi_VN";
import { useState } from "react";
import { theme } from "@/lib/antd-theme";
import { AuthProvider } from "@/lib/auth-context";

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () => new QueryClient({
      defaultOptions: {
        queries: { staleTime: 60 * 1000, refetchOnWindowFocus: false },
      },
    })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider theme={theme} locale={viVN}>
        <App>
          <AuthProvider>{children}</AuthProvider>
        </App>
      </ConfigProvider>
    </QueryClientProvider>
  );
}
```

### 8. Dashboard Home (src/app/(dashboard)/page.tsx)

```tsx
import { Typography } from "antd";

const { Title } = Typography;

export default function DashboardPage() {
  return (
    <div>
      <Title level={3}>Dashboard</Title>
      <p>Welcome to Operis Admin Dashboard</p>
    </div>
  );
}
```

## Todo List

- [ ] Create types/auth.ts with User, AuthResponse interfaces
- [ ] Create lib/api.ts with axios instance and interceptors
- [ ] Create services/auth.service.ts
- [ ] Create lib/auth-context.tsx with AuthProvider
- [ ] Create (auth)/login/page.tsx
- [ ] Create (dashboard)/layout.tsx with AdminLayout
- [ ] Update providers.tsx to include AuthProvider
- [ ] Create (dashboard)/page.tsx placeholder
- [ ] Test login flow with admin account
- [ ] Test token refresh on page reload
- [ ] Test redirect to login when not authenticated
- [ ] Test admin-only access (reject non-admin users)

## Success Criteria

1. Login page renders correctly
2. Admin user can login successfully
3. Non-admin user gets "no permission" error
4. After login, redirects to dashboard
5. Page refresh maintains auth state (token refresh works)
6. Logout clears state and redirects to login
7. Accessing dashboard without auth redirects to login
8. Sidebar navigation works correctly

## Notes

- Store refreshToken in localStorage for persistence
- Store accessToken in memory only (more secure)
- Check role === 'admin' after login
- Use Ant Design App component for message/notification context
