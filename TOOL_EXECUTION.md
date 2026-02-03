# Tool Execution System

## Vấn đề đã được giải quyết

**Trước đây:**
- AI gọi tool nhưng không thực thi → spam tool calls
- Không có feedback loop → AI không biết task hoàn thành
- Hardcode logic → khó mở rộng

**Bây giờ:**
- ✅ Tool execution thực sự
- ✅ Feedback loop hoàn chỉnh  
- ✅ Hệ thống linh hoạt, có thể mở rộng
- ✅ Error handling và security

## Workflow mới

```
User: "mở youtube tìm abc"
  ↓
AI: gọi tool browser(targetUrl="https://youtube.com/results?search_query=abc")  
  ↓
System: thực thi → mở browser thật
  ↓
Tool result: {"success": true, "url": "...", "message": "Successfully opened..."}
  ↓
AI nhận kết quả → "Đã mở YouTube và tìm kiếm 'abc' cho bạn!"
  ↓
DONE ✅ (không spam nữa)
```

## Tools được hỗ trợ

### 1. Browser Tool
```json
{
  "name": "browser",
  "parameters": {
    "action": "open",
    "targetUrl": "https://youtube.com/results?search_query=cat+videos"
  }
}
```
- Mở bất kỳ URL nào trong browser
- Auto-add https:// nếu thiếu
- Dùng macOS `open` command

### 2. Web Search Tool
```json
{
  "name": "web_search", 
  "parameters": {
    "query": "AI tool execution"
  }
}
```
- Tìm kiếm Google với từ khóa
- Internally mở Google search URL

### 3. Exec Tool
```json
{
  "name": "exec",
  "parameters": {
    "command": "ls -la"
  }
}
```
- Chạy shell commands
- ⚠️ **Security:** block dangerous commands (rm -rf, sudo, etc.)
- Timeout 30s, max output 1MB

### 4. File Read/Write Tools
```json
{
  "name": "file_read",
  "parameters": {
    "path": "/path/to/file.txt"
  }
}
```

```json
{
  "name": "file_write",
  "parameters": {
    "path": "/path/to/file.txt",
    "content": "Hello world"
  }
}
```

## Thêm Tool Mới

1. **Thêm vào `tool-executor.service.ts`:**
```typescript
case "my_new_tool":
  return this.executeMyNewTool(args);

private async executeMyNewTool(args: any): Promise<any> {
  const { param1, param2 } = args;
  
  // Validation
  if (!param1) {
    throw new Error("param1 is required");
  }
  
  // Execute logic
  const result = await doSomething(param1, param2);
  
  return {
    success: true,
    result,
    message: "Tool executed successfully",
  };
}
```

2. **Thêm definition vào `chat.service.ts`:**
```typescript
{
  type: "function",
  function: {
    name: "my_new_tool",
    description: "Mô tả tool này làm gì",
    parameters: {
      type: "object",
      properties: {
        param1: {
          type: "string", 
          description: "Tham số bắt buộc",
        },
        param2: {
          type: "string",
          description: "Tham số tùy chọn",
        },
      },
      required: ["param1"],
    },
  },
}
```

## Security Considerations

- **Exec tool:** Blocks dangerous commands
- **File operations:** No directory traversal protection yet (TODO)
- **Browser:** URL sanitization
- **Timeouts:** Prevent hanging processes
- **Error handling:** Graceful failures

## Testing

```bash
cd /Users/admin/operis-api
npm test -- tool-executor
```

## Debug Logs

Enable debug để xem tool execution:
```bash
DEBUG=chat:* npm start
```

Logs sẽ hiển thị:
```
[chat] Processing tool calls: browser
[tool] Executing browser with args: {action: "open", targetUrl: "https://youtube.com"}
[browser] Opened: https://youtube.com
[chat] Tool execution results: 1 results
[chat] Continuing conversation with tool results...
```

## Performance

- **Tool execution:** Async, non-blocking
- **Conversation continuation:** Recursive API calls cho đến khi hoàn thành
- **Token usage:** Tracked đầy đủ qua toàn bộ conversation chain

---

Hệ thống này giải quyết triệt để vấn đề spam tools bằng cách thực thi thật và tạo feedback loop hoàn chỉnh! 🚀