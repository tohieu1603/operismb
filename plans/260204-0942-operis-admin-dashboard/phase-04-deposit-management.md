# Phase 04: Deposit Management

**Status:** Pending
**Estimated:** 4-5 hours
**Depends on:** Phase 03

## Context

Implement deposit management for admin. View all deposits, filter by status/date/user, and manually complete or cancel deposits.

## Overview

- Deposit types and status enum
- Deposit service and query hooks
- Deposits list page with filters
- DepositStatusBadge component
- DepositActionModal (complete/cancel)
- Date range filter integration

## Requirements

### API Endpoints

```
GET  /deposits/admin/all    - All deposits (filters: userId, status, from, to)
POST /deposits/admin/tokens - Complete/cancel deposit { depositId, action, tokens?, note? }
```

### Deposit Statuses

- `pending` - Waiting for payment
- `completed` - Payment received, tokens credited
- `cancelled` - Cancelled by user or admin
- `expired` - Expired without payment

## Implementation Steps

### 1. Types (src/types/deposit.ts)

```ts
export type DepositStatus = "pending" | "completed" | "cancelled" | "expired";

export interface Deposit {
  id: string;
  userId: string;
  userEmail?: string;
  userName?: string;
  status: DepositStatus;
  amount: number;
  tokens: number;
  tierId?: string;
  tierName?: string;
  paymentInfo?: {
    bankName: string;
    accountNumber: string;
    accountName: string;
    amount: number;
    content: string;
  };
  completedAt?: string;
  cancelledAt?: string;
  expiredAt?: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  adminNote?: string;
}

export interface DepositListParams {
  userId?: string;
  status?: DepositStatus;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

export interface DepositListResponse {
  deposits: Deposit[];
  total: number;
  summary?: {
    totalAmount: number;
    totalTokens: number;
    pendingCount: number;
    completedCount: number;
  };
}

export interface DepositActionPayload {
  depositId: string;
  action: "complete" | "cancel";
  tokens?: number;
  note?: string;
}

export interface DepositActionResponse {
  success: boolean;
  deposit: Deposit;
  transaction?: {
    id: string;
    type: string;
    amount: number;
  };
  message: string;
}
```

### 2. Deposit Service (src/services/deposit.service.ts)

```ts
import { api } from "@/lib/api";
import {
  DepositListParams,
  DepositListResponse,
  DepositActionPayload,
  DepositActionResponse,
} from "@/types/deposit";

export const depositService = {
  async list(params: DepositListParams = {}): Promise<DepositListResponse> {
    const { data } = await api.get<DepositListResponse>("/deposits/admin/all", { params });
    return data;
  },

  async updateStatus(payload: DepositActionPayload): Promise<DepositActionResponse> {
    const { data } = await api.post<DepositActionResponse>("/deposits/admin/tokens", payload);
    return data;
  },
};
```

### 3. Query Hooks (src/hooks/queries/use-deposits.ts)

```ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { depositService } from "@/services/deposit.service";
import { DepositListParams, DepositActionPayload } from "@/types/deposit";

export const depositKeys = {
  all: ["deposits"] as const,
  lists: () => [...depositKeys.all, "list"] as const,
  list: (params: DepositListParams) => [...depositKeys.lists(), params] as const,
};

export function useDeposits(params: DepositListParams = {}) {
  return useQuery({
    queryKey: depositKeys.list(params),
    queryFn: () => depositService.list(params),
  });
}

export function useUpdateDeposit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: DepositActionPayload) => depositService.updateStatus(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: depositKeys.lists() });
    },
  });
}
```

### 4. DepositStatusBadge (src/components/deposits/DepositStatusBadge.tsx)

```tsx
import { Tag } from "antd";
import { DepositStatus } from "@/types/deposit";

const statusConfig: Record<DepositStatus, { color: string; label: string }> = {
  pending: { color: "orange", label: "Chờ thanh toán" },
  completed: { color: "green", label: "Hoàn thành" },
  cancelled: { color: "red", label: "Đã hủy" },
  expired: { color: "default", label: "Hết hạn" },
};

interface Props {
  status: DepositStatus;
}

export default function DepositStatusBadge({ status }: Props) {
  const config = statusConfig[status];
  return <Tag color={config.color}>{config.label}</Tag>;
}
```

### 5. DepositActionModal (src/components/deposits/DepositActionModal.tsx)

```tsx
"use client";

import { Modal, Form, InputNumber, Input, Radio, message, Descriptions, Alert } from "antd";
import { useUpdateDeposit } from "@/hooks/queries/use-deposits";
import { Deposit } from "@/types/deposit";
import { useEffect, useState } from "react";
import DepositStatusBadge from "./DepositStatusBadge";

interface Props {
  deposit: Deposit | null;
  onClose: () => void;
}

export default function DepositActionModal({ deposit, onClose }: Props) {
  const [form] = Form.useForm();
  const [action, setAction] = useState<"complete" | "cancel">("complete");
  const updateMutation = useUpdateDeposit();

  useEffect(() => {
    if (deposit) {
      form.resetFields();
      form.setFieldsValue({ tokens: deposit.tokens });
      setAction("complete");
    }
  }, [deposit, form]);

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      await updateMutation.mutateAsync({
        depositId: deposit!.id,
        action,
        tokens: action === "complete" ? values.tokens : undefined,
        note: values.note,
      });
      message.success(
        action === "complete"
          ? `Đã hoàn thành và cộng ${values.tokens.toLocaleString()} tokens`
          : "Đã hủy đơn nạp tiền"
      );
      onClose();
    } catch (error: any) {
      if (error.response?.data?.error) {
        message.error(error.response.data.error);
      }
    }
  };

  if (!deposit) return null;

  return (
    <Modal
      title="Xử lý đơn nạp tiền"
      open={!!deposit}
      onOk={handleOk}
      onCancel={onClose}
      confirmLoading={updateMutation.isPending}
      okText={action === "complete" ? "Hoàn thành & Cộng token" : "Hủy đơn"}
      okButtonProps={{ danger: action === "cancel" }}
      cancelText="Đóng"
      width={600}
    >
      <Descriptions bordered size="small" column={2} className="mb-4">
        <Descriptions.Item label="Mã đơn">{deposit.id}</Descriptions.Item>
        <Descriptions.Item label="Trạng thái">
          <DepositStatusBadge status={deposit.status} />
        </Descriptions.Item>
        <Descriptions.Item label="User">{deposit.userEmail}</Descriptions.Item>
        <Descriptions.Item label="Số tiền">{deposit.amount.toLocaleString()} VND</Descriptions.Item>
        <Descriptions.Item label="Tokens dự kiến">{deposit.tokens.toLocaleString()}</Descriptions.Item>
        <Descriptions.Item label="Nội dung CK">{deposit.paymentInfo?.content}</Descriptions.Item>
      </Descriptions>

      {deposit.status !== "pending" && (
        <Alert
          type="warning"
          message="Đơn này không ở trạng thái chờ thanh toán"
          className="mb-4"
        />
      )}

      <Form form={form} layout="vertical">
        <Form.Item label="Hành động">
          <Radio.Group value={action} onChange={(e) => setAction(e.target.value)}>
            <Radio.Button value="complete">Hoàn thành & Cộng token</Radio.Button>
            <Radio.Button value="cancel" danger>
              Hủy đơn
            </Radio.Button>
          </Radio.Group>
        </Form.Item>

        {action === "complete" && (
          <Form.Item
            name="tokens"
            label="Số token cộng cho user"
            rules={[
              { required: true, message: "Vui lòng nhập số token" },
              { type: "number", min: 1, message: "Số token phải > 0" },
            ]}
          >
            <InputNumber
              style={{ width: "100%" }}
              formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
              parser={(value) => value!.replace(/\$\s?|(,*)/g, "") as any}
            />
          </Form.Item>
        )}

        <Form.Item name="note" label="Ghi chú admin">
          <Input.TextArea rows={2} placeholder="Ghi chú lý do xử lý..." />
        </Form.Item>
      </Form>
    </Modal>
  );
}
```

### 6. Deposits List Page (src/app/(dashboard)/deposits/page.tsx)

```tsx
"use client";

import { useState } from "react";
import { Table, Select, Button, Space, Typography, Card, DatePicker, Input, Row, Col, Statistic } from "antd";
import { SearchOutlined, ReloadOutlined } from "@ant-design/icons";
import { useDeposits } from "@/hooks/queries/use-deposits";
import { DepositListParams, Deposit, DepositStatus } from "@/types/deposit";
import DepositStatusBadge from "@/components/deposits/DepositStatusBadge";
import DepositActionModal from "@/components/deposits/DepositActionModal";
import dayjs from "dayjs";
import Link from "next/link";

const { Title } = Typography;
const { RangePicker } = DatePicker;

const statusOptions = [
  { value: "pending", label: "Chờ thanh toán" },
  { value: "completed", label: "Hoàn thành" },
  { value: "cancelled", label: "Đã hủy" },
  { value: "expired", label: "Hết hạn" },
];

export default function DepositsPage() {
  const [params, setParams] = useState<DepositListParams>({ limit: 20, offset: 0 });
  const [selectedDeposit, setSelectedDeposit] = useState<Deposit | null>(null);
  const [userSearch, setUserSearch] = useState("");
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);

  const { data, isLoading, refetch } = useDeposits(params);

  const handleSearch = () => {
    setParams((prev) => ({
      ...prev,
      userId: userSearch || undefined,
      from: dateRange?.[0]?.toISOString(),
      to: dateRange?.[1]?.toISOString(),
      offset: 0,
    }));
  };

  const handleStatusChange = (status: DepositStatus | undefined) => {
    setParams((prev) => ({ ...prev, status, offset: 0 }));
  };

  const columns = [
    {
      title: "Mã đơn",
      dataIndex: "id",
      key: "id",
      width: 140,
      render: (id: string) => <span className="font-mono text-xs">{id}</span>,
    },
    {
      title: "User",
      dataIndex: "userEmail",
      key: "userEmail",
      render: (email: string, record: Deposit) => (
        <Link href={`/users/${record.userId}`} className="text-blue-600 hover:underline">
          {email}
        </Link>
      ),
    },
    {
      title: "Số tiền",
      dataIndex: "amount",
      key: "amount",
      align: "right" as const,
      render: (amount: number) => `${amount.toLocaleString()} VND`,
    },
    {
      title: "Tokens",
      dataIndex: "tokens",
      key: "tokens",
      align: "right" as const,
      render: (tokens: number) => tokens.toLocaleString(),
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      render: (status: DepositStatus) => <DepositStatusBadge status={status} />,
    },
    {
      title: "Ngày tạo",
      dataIndex: "createdAt",
      key: "createdAt",
      render: (date: string) => dayjs(date).format("DD/MM/YYYY HH:mm"),
    },
    {
      title: "Actions",
      key: "actions",
      render: (_: any, record: Deposit) => (
        <Button
          size="small"
          onClick={() => setSelectedDeposit(record)}
          disabled={record.status !== "pending"}
        >
          Xử lý
        </Button>
      ),
    },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <Title level={3}>Quản lý Deposits</Title>
        <Button icon={<ReloadOutlined />} onClick={() => refetch()}>
          Refresh
        </Button>
      </div>

      {data?.summary && (
        <Row gutter={16} className="mb-4">
          <Col span={6}>
            <Card>
              <Statistic title="Tổng tiền nạp" value={data.summary.totalAmount} suffix="VND" />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic title="Tổng tokens" value={data.summary.totalTokens} />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic title="Đang chờ" value={data.summary.pendingCount} valueStyle={{ color: "#faad14" }} />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic title="Hoàn thành" value={data.summary.completedCount} valueStyle={{ color: "#52c41a" }} />
            </Card>
          </Col>
        </Row>
      )}

      <Card className="mb-4">
        <Space wrap>
          <Input
            placeholder="User ID hoặc Email"
            prefix={<SearchOutlined />}
            value={userSearch}
            onChange={(e) => setUserSearch(e.target.value)}
            style={{ width: 200 }}
            allowClear
          />
          <Select
            placeholder="Trạng thái"
            allowClear
            style={{ width: 160 }}
            onChange={handleStatusChange}
            options={statusOptions}
          />
          <RangePicker
            placeholder={["Từ ngày", "Đến ngày"]}
            onChange={(dates) => setDateRange(dates as [dayjs.Dayjs, dayjs.Dayjs] | null)}
          />
          <Button type="primary" onClick={handleSearch}>
            Tìm kiếm
          </Button>
        </Space>
      </Card>

      <Table
        columns={columns}
        dataSource={data?.deposits}
        rowKey="id"
        loading={isLoading}
        pagination={{
          total: data?.total,
          pageSize: params.limit,
          current: Math.floor((params.offset || 0) / (params.limit || 20)) + 1,
          showSizeChanger: true,
          showTotal: (total) => `Tổng ${total} deposits`,
          onChange: (page, pageSize) =>
            setParams((prev) => ({
              ...prev,
              offset: (page - 1) * pageSize,
              limit: pageSize,
            })),
        }}
      />

      <DepositActionModal deposit={selectedDeposit} onClose={() => setSelectedDeposit(null)} />
    </div>
  );
}
```

### 7. Add User Deposits Tab (update in user detail page)

In `src/app/(dashboard)/users/[id]/page.tsx`, update deposits tab:

```tsx
// Add this to imports
import { useDeposits } from "@/hooks/queries/use-deposits";
import DepositStatusBadge from "@/components/deposits/DepositStatusBadge";

// Inside component, add:
const { data: userDeposits, isLoading: depositsLoading } = useDeposits({ userId: id });

// Update deposits tab children:
{
  key: "deposits",
  label: "Deposits",
  children: (
    <Table
      loading={depositsLoading}
      dataSource={userDeposits?.deposits}
      rowKey="id"
      columns={[
        { title: "ID", dataIndex: "id", key: "id", width: 140 },
        { title: "Amount", dataIndex: "amount", key: "amount", render: (v: number) => `${v.toLocaleString()} VND` },
        { title: "Tokens", dataIndex: "tokens", key: "tokens", render: (v: number) => v.toLocaleString() },
        { title: "Status", dataIndex: "status", key: "status", render: (s: DepositStatus) => <DepositStatusBadge status={s} /> },
        { title: "Date", dataIndex: "createdAt", key: "createdAt", render: (d: string) => dayjs(d).format("DD/MM/YYYY HH:mm") },
      ]}
      pagination={{ pageSize: 10 }}
    />
  ),
}
```

## Todo List

- [ ] Create types/deposit.ts with all interfaces
- [ ] Create services/deposit.service.ts
- [ ] Create hooks/queries/use-deposits.ts
- [ ] Create components/deposits/DepositStatusBadge.tsx
- [ ] Create components/deposits/DepositActionModal.tsx
- [ ] Create (dashboard)/deposits/page.tsx
- [ ] Add summary statistics cards
- [ ] Add status filter
- [ ] Add date range filter
- [ ] Add user filter
- [ ] Update user detail page with deposits tab
- [ ] Test complete deposit flow
- [ ] Test cancel deposit flow
- [ ] Handle edge cases (non-pending deposits)

## Success Criteria

1. Deposits list displays with all data
2. Summary stats show correct totals
3. Status filter works correctly
4. Date range filter works
5. Can complete pending deposits and credit tokens
6. Can cancel pending deposits
7. Non-pending deposits show disabled action button
8. User detail page shows user's deposits
9. All actions show appropriate feedback

## Notes

- Only pending deposits can be completed/cancelled
- When completing, admin can adjust token amount
- Admin note is optional but recommended
- Date range uses ISO format for API
- Use RangePicker from Ant Design for date filtering
