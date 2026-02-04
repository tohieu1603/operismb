# Phase 03: User Management

**Status:** Pending
**Estimated:** 5-6 hours
**Depends on:** Phase 02

## Context

Implement user management features for admin. Includes listing, viewing details, editing, deleting users, and topping up tokens.

## Overview

- User types and API response types
- TanStack Query hooks for users
- Users list page with table, search, filters
- User detail page with tabs
- TopupModal component
- UserEditModal component

## Requirements

### API Endpoints

```
GET    /users              - List users (pagination, search, role filter)
GET    /users/:id          - User detail
PATCH  /users/:id          - Update user (name, role, isActive)
DELETE /users/:id          - Delete user
POST   /users/:id/topup    - Add tokens { amount, note }
```

### Query Params for List

- page: number (default 1)
- limit: number (default 20, max 100)
- search: string (email or name)
- role: "user" | "admin"
- sortBy: "createdAt" | "name" | "email" | "tokenBalance"
- sortOrder: "asc" | "desc"

## Implementation Steps

### 1. Types (src/types/user.ts)

```ts
export interface User {
  id: string;
  email: string;
  name: string;
  role: "user" | "admin";
  tokenBalance: number;
  isActive?: boolean;
  totalDeposited?: number;
  totalSpent?: number;
  apiKeysCount?: number;
  conversationsCount?: number;
  lastActiveAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserListParams {
  page?: number;
  limit?: number;
  search?: string;
  role?: "user" | "admin";
  sortBy?: "createdAt" | "name" | "email" | "tokenBalance";
  sortOrder?: "asc" | "desc";
}

export interface UserListResponse {
  data: User[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface UpdateUserPayload {
  name?: string;
  role?: "user" | "admin";
  isActive?: boolean;
}

export interface TopupPayload {
  amount: number;
  note?: string;
}

export interface TopupResponse {
  success: boolean;
  user: User;
  transaction: {
    id: string;
    type: string;
    amount: number;
    balance: number;
  };
  message: string;
}
```

### 2. User Service (src/services/user.service.ts)

```ts
import { api } from "@/lib/api";
import {
  User,
  UserListParams,
  UserListResponse,
  UpdateUserPayload,
  TopupPayload,
  TopupResponse,
} from "@/types/user";

export const userService = {
  async list(params: UserListParams = {}): Promise<UserListResponse> {
    const { data } = await api.get<UserListResponse>("/users", { params });
    return data;
  },

  async getById(id: string): Promise<User> {
    const { data } = await api.get<User>(`/users/${id}`);
    return data;
  },

  async update(id: string, payload: UpdateUserPayload): Promise<User> {
    const { data } = await api.patch<User>(`/users/${id}`, payload);
    return data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/users/${id}`);
  },

  async topup(id: string, payload: TopupPayload): Promise<TopupResponse> {
    const { data } = await api.post<TopupResponse>(`/users/${id}/topup`, payload);
    return data;
  },
};
```

### 3. Query Hooks (src/hooks/queries/use-users.ts)

```ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { userService } from "@/services/user.service";
import { UserListParams, UpdateUserPayload, TopupPayload } from "@/types/user";

export const userKeys = {
  all: ["users"] as const,
  lists: () => [...userKeys.all, "list"] as const,
  list: (params: UserListParams) => [...userKeys.lists(), params] as const,
  details: () => [...userKeys.all, "detail"] as const,
  detail: (id: string) => [...userKeys.details(), id] as const,
};

export function useUsers(params: UserListParams = {}) {
  return useQuery({
    queryKey: userKeys.list(params),
    queryFn: () => userService.list(params),
  });
}

export function useUser(id: string) {
  return useQuery({
    queryKey: userKeys.detail(id),
    queryFn: () => userService.getById(id),
    enabled: !!id,
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateUserPayload }) =>
      userService.update(id, payload),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: userKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
    },
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => userService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
    },
  });
}

export function useTopupUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: TopupPayload }) =>
      userService.topup(id, payload),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: userKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
    },
  });
}
```

### 4. Users List Page (src/app/(dashboard)/users/page.tsx)

```tsx
"use client";

import { useState } from "react";
import { Table, Input, Select, Button, Space, Tag, Typography, Popconfirm, message, Card } from "antd";
import { SearchOutlined, PlusOutlined, EditOutlined, DeleteOutlined, DollarOutlined } from "@ant-design/icons";
import { useUsers, useDeleteUser } from "@/hooks/queries/use-users";
import { UserListParams, User } from "@/types/user";
import Link from "next/link";
import TopupModal from "@/components/users/TopupModal";
import UserEditModal from "@/components/users/UserEditModal";
import dayjs from "dayjs";

const { Title } = Typography;

export default function UsersPage() {
  const [params, setParams] = useState<UserListParams>({ page: 1, limit: 20 });
  const [search, setSearch] = useState("");
  const [topupUser, setTopupUser] = useState<User | null>(null);
  const [editUser, setEditUser] = useState<User | null>(null);

  const { data, isLoading } = useUsers(params);
  const deleteUser = useDeleteUser();

  const handleSearch = () => {
    setParams((prev) => ({ ...prev, search, page: 1 }));
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteUser.mutateAsync(id);
      message.success("Xóa user thành công");
    } catch (error: any) {
      message.error(error.response?.data?.error || "Xóa user thất bại");
    }
  };

  const columns = [
    {
      title: "Email",
      dataIndex: "email",
      key: "email",
      render: (email: string, record: User) => (
        <Link href={`/users/${record.id}`} className="text-blue-600 hover:underline">
          {email}
        </Link>
      ),
    },
    { title: "Tên", dataIndex: "name", key: "name" },
    {
      title: "Role",
      dataIndex: "role",
      key: "role",
      render: (role: string) => (
        <Tag color={role === "admin" ? "red" : "blue"}>{role.toUpperCase()}</Tag>
      ),
    },
    {
      title: "Token Balance",
      dataIndex: "tokenBalance",
      key: "tokenBalance",
      render: (balance: number) => balance.toLocaleString(),
    },
    {
      title: "Ngày tạo",
      dataIndex: "createdAt",
      key: "createdAt",
      render: (date: string) => dayjs(date).format("DD/MM/YYYY"),
    },
    {
      title: "Actions",
      key: "actions",
      render: (_: any, record: User) => (
        <Space>
          <Button icon={<DollarOutlined />} onClick={() => setTopupUser(record)} size="small">
            Topup
          </Button>
          <Button icon={<EditOutlined />} onClick={() => setEditUser(record)} size="small" />
          <Popconfirm
            title="Xóa user này?"
            description="Tất cả dữ liệu liên quan sẽ bị xóa."
            onConfirm={() => handleDelete(record.id)}
            okText="Xóa"
            cancelText="Hủy"
          >
            <Button icon={<DeleteOutlined />} danger size="small" />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <Title level={3}>Quản lý Users</Title>
      </div>

      <Card className="mb-4">
        <Space wrap>
          <Input
            placeholder="Tìm theo email hoặc tên"
            prefix={<SearchOutlined />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onPressEnter={handleSearch}
            style={{ width: 250 }}
          />
          <Select
            placeholder="Role"
            allowClear
            style={{ width: 120 }}
            onChange={(value) => setParams((prev) => ({ ...prev, role: value, page: 1 }))}
            options={[
              { value: "user", label: "User" },
              { value: "admin", label: "Admin" },
            ]}
          />
          <Button type="primary" onClick={handleSearch}>
            Tìm kiếm
          </Button>
        </Space>
      </Card>

      <Table
        columns={columns}
        dataSource={data?.data}
        rowKey="id"
        loading={isLoading}
        pagination={{
          current: params.page,
          pageSize: params.limit,
          total: data?.pagination.total,
          showSizeChanger: true,
          showTotal: (total) => `Tổng ${total} users`,
          onChange: (page, pageSize) => setParams((prev) => ({ ...prev, page, limit: pageSize })),
        }}
      />

      <TopupModal user={topupUser} onClose={() => setTopupUser(null)} />
      <UserEditModal user={editUser} onClose={() => setEditUser(null)} />
    </div>
  );
}
```

### 5. TopupModal (src/components/users/TopupModal.tsx)

```tsx
"use client";

import { Modal, Form, InputNumber, Input, message } from "antd";
import { useTopupUser } from "@/hooks/queries/use-users";
import { User } from "@/types/user";
import { useEffect } from "react";

interface Props {
  user: User | null;
  onClose: () => void;
}

export default function TopupModal({ user, onClose }: Props) {
  const [form] = Form.useForm();
  const topupMutation = useTopupUser();

  useEffect(() => {
    if (user) form.resetFields();
  }, [user, form]);

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      await topupMutation.mutateAsync({
        id: user!.id,
        payload: { amount: values.amount, note: values.note },
      });
      message.success(`Đã nạp ${values.amount.toLocaleString()} tokens cho ${user?.email}`);
      onClose();
    } catch (error: any) {
      if (error.response?.data?.error) {
        message.error(error.response.data.error);
      }
    }
  };

  return (
    <Modal
      title={`Nạp token cho ${user?.email}`}
      open={!!user}
      onOk={handleOk}
      onCancel={onClose}
      confirmLoading={topupMutation.isPending}
      okText="Nạp token"
      cancelText="Hủy"
    >
      <div className="mb-4">
        <p>Số dư hiện tại: <strong>{user?.tokenBalance?.toLocaleString()}</strong> tokens</p>
      </div>
      <Form form={form} layout="vertical">
        <Form.Item
          name="amount"
          label="Số token cần nạp"
          rules={[
            { required: true, message: "Vui lòng nhập số token" },
            { type: "number", min: 1, message: "Số token phải lớn hơn 0" },
          ]}
        >
          <InputNumber
            style={{ width: "100%" }}
            formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
            parser={(value) => value!.replace(/\$\s?|(,*)/g, "") as any}
            placeholder="Nhập số token"
          />
        </Form.Item>
        <Form.Item name="note" label="Ghi chú (tùy chọn)">
          <Input.TextArea rows={3} placeholder="Lý do nạp token..." />
        </Form.Item>
      </Form>
    </Modal>
  );
}
```

### 6. UserEditModal (src/components/users/UserEditModal.tsx)

```tsx
"use client";

import { Modal, Form, Input, Select, Switch, message } from "antd";
import { useUpdateUser } from "@/hooks/queries/use-users";
import { User } from "@/types/user";
import { useEffect } from "react";

interface Props {
  user: User | null;
  onClose: () => void;
}

export default function UserEditModal({ user, onClose }: Props) {
  const [form] = Form.useForm();
  const updateMutation = useUpdateUser();

  useEffect(() => {
    if (user) {
      form.setFieldsValue({
        name: user.name,
        role: user.role,
        isActive: user.isActive !== false,
      });
    }
  }, [user, form]);

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      await updateMutation.mutateAsync({ id: user!.id, payload: values });
      message.success("Cập nhật user thành công");
      onClose();
    } catch (error: any) {
      if (error.response?.data?.error) {
        message.error(error.response.data.error);
      }
    }
  };

  return (
    <Modal
      title={`Chỉnh sửa user: ${user?.email}`}
      open={!!user}
      onOk={handleOk}
      onCancel={onClose}
      confirmLoading={updateMutation.isPending}
      okText="Lưu"
      cancelText="Hủy"
    >
      <Form form={form} layout="vertical">
        <Form.Item name="name" label="Tên" rules={[{ required: true, message: "Vui lòng nhập tên" }]}>
          <Input placeholder="Tên user" />
        </Form.Item>
        <Form.Item name="role" label="Role">
          <Select
            options={[
              { value: "user", label: "User" },
              { value: "admin", label: "Admin" },
            ]}
          />
        </Form.Item>
        <Form.Item name="isActive" label="Trạng thái" valuePropName="checked">
          <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
```

### 7. User Detail Page (src/app/(dashboard)/users/[id]/page.tsx)

```tsx
"use client";

import { useParams, useRouter } from "next/navigation";
import { Card, Descriptions, Tabs, Tag, Spin, Button, Space, Statistic, Row, Col, Typography } from "antd";
import { ArrowLeftOutlined, DollarOutlined, EditOutlined } from "@ant-design/icons";
import { useUser } from "@/hooks/queries/use-users";
import { useState } from "react";
import TopupModal from "@/components/users/TopupModal";
import UserEditModal from "@/components/users/UserEditModal";
import dayjs from "dayjs";

const { Title } = Typography;

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: user, isLoading } = useUser(id);
  const [showTopup, setShowTopup] = useState(false);
  const [showEdit, setShowEdit] = useState(false);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spin size="large" />
      </div>
    );
  }

  if (!user) {
    return <div>User not found</div>;
  }

  const items = [
    {
      key: "overview",
      label: "Overview",
      children: (
        <div>
          <Row gutter={16} className="mb-6">
            <Col span={8}>
              <Card>
                <Statistic title="Token Balance" value={user.tokenBalance} />
              </Card>
            </Col>
            <Col span={8}>
              <Card>
                <Statistic title="Total Deposited" value={user.totalDeposited || 0} />
              </Card>
            </Col>
            <Col span={8}>
              <Card>
                <Statistic title="Total Spent" value={user.totalSpent || 0} />
              </Card>
            </Col>
          </Row>
          <Descriptions bordered column={2}>
            <Descriptions.Item label="ID">{user.id}</Descriptions.Item>
            <Descriptions.Item label="Email">{user.email}</Descriptions.Item>
            <Descriptions.Item label="Name">{user.name}</Descriptions.Item>
            <Descriptions.Item label="Role">
              <Tag color={user.role === "admin" ? "red" : "blue"}>{user.role.toUpperCase()}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="API Keys">{user.apiKeysCount || 0}</Descriptions.Item>
            <Descriptions.Item label="Conversations">{user.conversationsCount || 0}</Descriptions.Item>
            <Descriptions.Item label="Created">{dayjs(user.createdAt).format("DD/MM/YYYY HH:mm")}</Descriptions.Item>
            <Descriptions.Item label="Last Active">
              {user.lastActiveAt ? dayjs(user.lastActiveAt).format("DD/MM/YYYY HH:mm") : "-"}
            </Descriptions.Item>
          </Descriptions>
        </div>
      ),
    },
    {
      key: "deposits",
      label: "Deposits",
      children: <div>User deposits history (implement in Phase 04)</div>,
    },
    {
      key: "tokens",
      label: "Token Transactions",
      children: <div>Token transaction history (implement in Phase 04)</div>,
    },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => router.push("/users")}>
            Back
          </Button>
          <Title level={3} className="mb-0">
            {user.name}
          </Title>
        </Space>
        <Space>
          <Button icon={<DollarOutlined />} onClick={() => setShowTopup(true)}>
            Topup
          </Button>
          <Button icon={<EditOutlined />} onClick={() => setShowEdit(true)}>
            Edit
          </Button>
        </Space>
      </div>

      <Tabs items={items} defaultActiveKey="overview" />

      <TopupModal user={showTopup ? user : null} onClose={() => setShowTopup(false)} />
      <UserEditModal user={showEdit ? user : null} onClose={() => setShowEdit(false)} />
    </div>
  );
}
```

## Todo List

- [ ] Create types/user.ts with all interfaces
- [ ] Create services/user.service.ts
- [ ] Create hooks/queries/use-users.ts with TanStack Query hooks
- [ ] Create (dashboard)/users/page.tsx - user list with table
- [ ] Create components/users/TopupModal.tsx
- [ ] Create components/users/UserEditModal.tsx
- [ ] Create (dashboard)/users/[id]/page.tsx - user detail
- [ ] Add search functionality
- [ ] Add role filter
- [ ] Add pagination
- [ ] Add sorting
- [ ] Test CRUD operations
- [ ] Test topup functionality
- [ ] Handle error states properly

## Success Criteria

1. User list displays with pagination
2. Search by email/name works
3. Filter by role works
4. Can view user details
5. Can edit user (name, role, isActive)
6. Can delete user with confirmation
7. Can topup tokens with note
8. All actions show success/error messages
9. Data refreshes after mutations

## Notes

- Use Tag component for role display (admin=red, user=blue)
- Format token numbers with locale (toLocaleString)
- Confirm before delete with warning about data loss
- TopupModal shows current balance before topup
