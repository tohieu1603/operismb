# Phase 05: Dashboard & Polish

**Status:** Pending
**Estimated:** 3-4 hours
**Depends on:** Phase 04

## Context

Final phase - build dashboard home page with stats and recent activities. Add loading states, error boundaries, and polish responsive design.

## Overview

- Dashboard page with stats cards
- Recent deposits widget
- Recent users widget
- Loading states (skeletons)
- Error boundaries
- Responsive design fixes
- Settings page (optional)

## Implementation Steps

### 1. Dashboard Stats Service (src/services/stats.service.ts)

```ts
import { api } from "@/lib/api";

export interface DashboardStats {
  totalUsers: number;
  totalAdmins: number;
  activeUsers: number;
  totalDeposits: number;
  pendingDeposits: number;
  totalRevenue: number;
  totalTokensIssued: number;
  recentActivity: {
    newUsers: number;
    depositsToday: number;
    tokensUsedToday: number;
  };
}

export const statsService = {
  // If backend doesn't have stats endpoint, aggregate from existing endpoints
  async getDashboardStats(): Promise<DashboardStats> {
    // Option 1: If backend has dedicated stats endpoint
    // const { data } = await api.get<DashboardStats>("/admin/stats");
    // return data;

    // Option 2: Aggregate from existing endpoints
    const [usersRes, depositsRes] = await Promise.all([
      api.get("/users", { params: { limit: 1 } }),
      api.get("/deposits/admin/all", { params: { limit: 1 } }),
    ]);

    return {
      totalUsers: usersRes.data.pagination?.total || 0,
      totalAdmins: 0, // Would need separate query
      activeUsers: 0,
      totalDeposits: depositsRes.data.total || 0,
      pendingDeposits: depositsRes.data.summary?.pendingCount || 0,
      totalRevenue: depositsRes.data.summary?.totalAmount || 0,
      totalTokensIssued: depositsRes.data.summary?.totalTokens || 0,
      recentActivity: {
        newUsers: 0,
        depositsToday: 0,
        tokensUsedToday: 0,
      },
    };
  },
};
```

### 2. Dashboard Stats Hook (src/hooks/queries/use-stats.ts)

```ts
import { useQuery } from "@tanstack/react-query";
import { statsService } from "@/services/stats.service";

export function useDashboardStats() {
  return useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: () => statsService.getDashboardStats(),
    refetchInterval: 60000, // Refresh every minute
  });
}
```

### 3. StatCard Component (src/components/dashboard/StatCard.tsx)

```tsx
import { Card, Statistic, Skeleton } from "antd";
import { ReactNode } from "react";

interface Props {
  title: string;
  value: number | string;
  prefix?: ReactNode;
  suffix?: string;
  loading?: boolean;
  valueStyle?: React.CSSProperties;
}

export default function StatCard({ title, value, prefix, suffix, loading, valueStyle }: Props) {
  if (loading) {
    return (
      <Card>
        <Skeleton active paragraph={{ rows: 1 }} />
      </Card>
    );
  }

  return (
    <Card>
      <Statistic title={title} value={value} prefix={prefix} suffix={suffix} valueStyle={valueStyle} />
    </Card>
  );
}
```

### 4. RecentDeposits Widget (src/components/dashboard/RecentDeposits.tsx)

```tsx
"use client";

import { Card, Table, Typography, Empty } from "antd";
import { useDeposits } from "@/hooks/queries/use-deposits";
import DepositStatusBadge from "@/components/deposits/DepositStatusBadge";
import { DepositStatus } from "@/types/deposit";
import dayjs from "dayjs";
import Link from "next/link";

const { Title } = Typography;

export default function RecentDeposits() {
  const { data, isLoading } = useDeposits({ limit: 5 });

  const columns = [
    {
      title: "User",
      dataIndex: "userEmail",
      key: "userEmail",
      ellipsis: true,
    },
    {
      title: "Amount",
      dataIndex: "amount",
      key: "amount",
      render: (v: number) => `${v.toLocaleString()}`,
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (s: DepositStatus) => <DepositStatusBadge status={s} />,
    },
    {
      title: "Time",
      dataIndex: "createdAt",
      key: "createdAt",
      render: (d: string) => dayjs(d).fromNow(),
    },
  ];

  return (
    <Card
      title={<Title level={5}>Recent Deposits</Title>}
      extra={<Link href="/deposits">View all</Link>}
    >
      {data?.deposits?.length ? (
        <Table
          columns={columns}
          dataSource={data.deposits}
          rowKey="id"
          loading={isLoading}
          pagination={false}
          size="small"
        />
      ) : (
        <Empty description="No deposits yet" />
      )}
    </Card>
  );
}
```

### 5. RecentUsers Widget (src/components/dashboard/RecentUsers.tsx)

```tsx
"use client";

import { Card, List, Avatar, Typography, Tag, Empty } from "antd";
import { UserOutlined } from "@ant-design/icons";
import { useUsers } from "@/hooks/queries/use-users";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import Link from "next/link";

dayjs.extend(relativeTime);

const { Title, Text } = Typography;

export default function RecentUsers() {
  const { data, isLoading } = useUsers({ limit: 5, sortBy: "createdAt", sortOrder: "desc" });

  return (
    <Card
      title={<Title level={5}>Recent Users</Title>}
      extra={<Link href="/users">View all</Link>}
      loading={isLoading}
    >
      {data?.data?.length ? (
        <List
          itemLayout="horizontal"
          dataSource={data.data}
          renderItem={(user) => (
            <List.Item>
              <List.Item.Meta
                avatar={<Avatar icon={<UserOutlined />} />}
                title={
                  <Link href={`/users/${user.id}`}>
                    {user.name} {user.role === "admin" && <Tag color="red">Admin</Tag>}
                  </Link>
                }
                description={
                  <>
                    <Text type="secondary">{user.email}</Text>
                    <br />
                    <Text type="secondary" className="text-xs">
                      Joined {dayjs(user.createdAt).fromNow()}
                    </Text>
                  </>
                }
              />
            </List.Item>
          )}
        />
      ) : (
        <Empty description="No users yet" />
      )}
    </Card>
  );
}
```

### 6. Dashboard Page (src/app/(dashboard)/page.tsx)

```tsx
"use client";

import { Row, Col, Typography, Alert } from "antd";
import {
  UserOutlined,
  WalletOutlined,
  DollarOutlined,
  ThunderboltOutlined,
  ClockCircleOutlined,
} from "@ant-design/icons";
import { useDashboardStats } from "@/hooks/queries/use-stats";
import StatCard from "@/components/dashboard/StatCard";
import RecentDeposits from "@/components/dashboard/RecentDeposits";
import RecentUsers from "@/components/dashboard/RecentUsers";
import { useAuth } from "@/lib/auth-context";

const { Title } = Typography;

export default function DashboardPage() {
  const { user } = useAuth();
  const { data: stats, isLoading, error } = useDashboardStats();

  return (
    <div>
      <Title level={3}>Dashboard</Title>
      <p className="text-gray-500 mb-6">Welcome back, {user?.name}!</p>

      {error && (
        <Alert
          message="Could not load statistics"
          description="Please try refreshing the page"
          type="warning"
          showIcon
          className="mb-4"
        />
      )}

      <Row gutter={[16, 16]} className="mb-6">
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            title="Total Users"
            value={stats?.totalUsers || 0}
            prefix={<UserOutlined />}
            loading={isLoading}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            title="Total Deposits"
            value={stats?.totalDeposits || 0}
            prefix={<WalletOutlined />}
            loading={isLoading}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            title="Pending Deposits"
            value={stats?.pendingDeposits || 0}
            prefix={<ClockCircleOutlined />}
            loading={isLoading}
            valueStyle={{ color: "#faad14" }}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            title="Total Revenue"
            value={stats?.totalRevenue || 0}
            prefix={<DollarOutlined />}
            suffix="VND"
            loading={isLoading}
            valueStyle={{ color: "#52c41a" }}
          />
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={14}>
          <RecentDeposits />
        </Col>
        <Col xs={24} lg={10}>
          <RecentUsers />
        </Col>
      </Row>
    </div>
  );
}
```

### 7. Error Boundary (src/components/ErrorBoundary.tsx)

```tsx
"use client";

import { Component, ReactNode } from "react";
import { Result, Button } from "antd";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Error caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Result
          status="error"
          title="Something went wrong"
          subTitle={this.state.error?.message || "An unexpected error occurred"}
          extra={
            <Button type="primary" onClick={() => window.location.reload()}>
              Reload Page
            </Button>
          }
        />
      );
    }

    return this.props.children;
  }
}
```

### 8. Loading Skeleton (src/components/ui/PageLoading.tsx)

```tsx
import { Skeleton, Card, Space } from "antd";

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <Card>
      <Space direction="vertical" className="w-full">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} active paragraph={{ rows: 1 }} />
        ))}
      </Space>
    </Card>
  );
}

export function PageLoading() {
  return (
    <div>
      <Skeleton active paragraph={{ rows: 0 }} className="mb-4" />
      <TableSkeleton />
    </div>
  );
}
```

### 9. Responsive Layout Fixes

Update AdminLayout in `src/app/(dashboard)/layout.tsx`:

```tsx
// Add collapsed state for mobile
const [collapsed, setCollapsed] = useState(false);
const [isMobile, setIsMobile] = useState(false);

useEffect(() => {
  const handleResize = () => {
    setIsMobile(window.innerWidth < 768);
    if (window.innerWidth < 768) {
      setCollapsed(true);
    }
  };
  handleResize();
  window.addEventListener("resize", handleResize);
  return () => window.removeEventListener("resize", handleResize);
}, []);

// Update Sider
<Sider
  theme="dark"
  width={220}
  collapsedWidth={isMobile ? 0 : 80}
  collapsed={collapsed}
  onCollapse={setCollapsed}
  breakpoint="md"
  trigger={null}
>

// Add menu toggle button in Header
<Header className="bg-white px-4 flex items-center justify-between shadow-sm">
  <Button
    type="text"
    icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
    onClick={() => setCollapsed(!collapsed)}
    className="lg:hidden"
  />
  ...
</Header>
```

### 10. Settings Page (Optional) (src/app/(dashboard)/settings/page.tsx)

```tsx
"use client";

import { Card, Form, Input, InputNumber, Switch, Button, Typography, message, Divider } from "antd";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

const { Title } = Typography;

interface Settings {
  llm: { defaultModel: string };
  pricing: { tokenRate: number };
  features: { registrationEnabled: boolean; chatEnabled: boolean };
  limits: { chatRateLimit: number; maxApiKeys: number };
}

export default function SettingsPage() {
  const [form] = Form.useForm();
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const { data } = await api.get<Settings>("/settings");
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (values: Partial<Settings>) => {
      const { data } = await api.post("/settings", values);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      message.success("Settings saved");
    },
    onError: (error: any) => {
      message.error(error.response?.data?.error || "Failed to save");
    },
  });

  const handleSave = async () => {
    const values = await form.validateFields();
    saveMutation.mutate({
      pricing: { tokenRate: values.tokenRate },
      features: {
        registrationEnabled: values.registrationEnabled,
        chatEnabled: values.chatEnabled,
      },
      limits: {
        chatRateLimit: values.chatRateLimit,
        maxApiKeys: values.maxApiKeys,
      },
    });
  };

  return (
    <div>
      <Title level={3}>System Settings</Title>

      <Card loading={isLoading}>
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            tokenRate: settings?.pricing?.tokenRate,
            registrationEnabled: settings?.features?.registrationEnabled,
            chatEnabled: settings?.features?.chatEnabled,
            chatRateLimit: settings?.limits?.chatRateLimit,
            maxApiKeys: settings?.limits?.maxApiKeys,
          }}
        >
          <Title level={5}>Pricing</Title>
          <Form.Item name="tokenRate" label="Token Rate (VND per 1000 tokens)">
            <InputNumber min={1} style={{ width: 200 }} />
          </Form.Item>

          <Divider />

          <Title level={5}>Features</Title>
          <Form.Item name="registrationEnabled" label="User Registration" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="chatEnabled" label="Chat Feature" valuePropName="checked">
            <Switch />
          </Form.Item>

          <Divider />

          <Title level={5}>Limits</Title>
          <Form.Item name="chatRateLimit" label="Chat Rate Limit (per minute)">
            <InputNumber min={1} style={{ width: 200 }} />
          </Form.Item>
          <Form.Item name="maxApiKeys" label="Max API Keys per User">
            <InputNumber min={1} style={{ width: 200 }} />
          </Form.Item>

          <Form.Item>
            <Button type="primary" onClick={handleSave} loading={saveMutation.isPending}>
              Save Settings
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
```

## Todo List

- [ ] Create services/stats.service.ts
- [ ] Create hooks/queries/use-stats.ts
- [ ] Create components/dashboard/StatCard.tsx
- [ ] Create components/dashboard/RecentDeposits.tsx
- [ ] Create components/dashboard/RecentUsers.tsx
- [ ] Update (dashboard)/page.tsx with dashboard content
- [ ] Create components/ErrorBoundary.tsx
- [ ] Create components/ui/PageLoading.tsx
- [ ] Add responsive fixes to AdminLayout
- [ ] Add dayjs relativeTime plugin
- [ ] Create (dashboard)/settings/page.tsx (optional)
- [ ] Test on mobile viewport
- [ ] Test error boundary
- [ ] Review all pages for consistent styling

## Success Criteria

1. Dashboard shows stats cards with loading states
2. Recent deposits widget shows latest 5 deposits
3. Recent users widget shows latest 5 users
4. Stats refresh periodically
5. Error boundary catches and displays errors gracefully
6. Layout works on mobile (collapsible sidebar)
7. Settings page allows config changes (if implemented)
8. All pages have consistent look and feel

## Notes

- Use dayjs.fromNow() for relative times
- Stats may be aggregated from multiple endpoints
- Error boundary should be wrapped around main content
- Mobile breakpoint at 768px (md)
- Consider adding charts in future (recharts or @ant-design/charts)

## Future Enhancements

- Charts (revenue over time, user growth)
- Token usage analytics
- Export data to CSV
- Activity logs
- Dark mode toggle
