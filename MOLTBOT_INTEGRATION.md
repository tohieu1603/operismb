# Moltbot Integration

## Overview
Thay vì tự implement tools, operis-api giờ **gọi đến Moltbot** để thực thi tools có sẵn.

## Moltbot Tools Available:
- **browser**: Mở web, click, fill forms, automation  
- **exec**: Chạy shell commands
- **web_search**: Tìm kiếm web
- **web_fetch**: Fetch content từ URLs
- **message**: Gửi tin nhắn qua platforms
- **zalouser**: Zalo automation
- **nodes**: Control paired devices
- **sessions_spawn**: Tạo sub-agents
- **tts**: Text to speech
- **canvas**: Present/eval UI

## Configuration

### 1. Environment Variables
```bash
# .env
MOLTBOT_API_URL=http://localhost:3000
MOLTBOT_API_KEY=your_api_key_here
```

### 2. Moltbot Setup
```bash
# Start Moltbot daemon
moltbot gateway start

# Check status  
moltbot gateway status

# Get API endpoint info
moltbot gateway config.get
```

## Integration Methods

### Method 1: Direct API (Preferred)
```typescript
// POST /api/tools/execute
{
  "tool": "browser",
  "parameters": {
    "action": "open", 
    "targetUrl": "https://facebook.com"
  }
}
```

### Method 2: Sub-Agent Sessions (Fallback)
```typescript
// POST /api/sessions/spawn  
{
  "task": "Mở Facebook và login với abc@gmail.com",
  "agentId": "main",
  "cleanup": "delete"
}
```

## Example Flow

```
User: "mở facebook và login tài khoản abc"
  ↓
Operis API: calls DeepSeek AI
  ↓  
DeepSeek: tool_call browser(targetUrl="https://facebook.com")
  ↓
Operis: forwards to → Moltbot API 
  ↓
Moltbot: executes browser tool (có thể fill forms, click, etc.)
  ↓
Moltbot: returns result
  ↓
Operis: forwards result → DeepSeek
  ↓
DeepSeek: "Đã mở Facebook và login thành công!"
```

## Advanced Tools via Moltbot

### Browser Automation
Moltbot's browser tool có thể:
```json
{
  "tool": "browser", 
  "parameters": {
    "action": "act",
    "request": {
      "kind": "fill",
      "ref": "#email", 
      "text": "abc@gmail.com"
    }
  }
}
```

### Multi-step Automation
```json
{
  "tool": "sessions_spawn",
  "parameters": {
    "task": "Mở Facebook, login với abc@gmail.com, post status 'Hello World', rồi logout",
    "agentId": "automation"
  }
}
```

### Zalo Integration
```json
{
  "tool": "zalouser",
  "parameters": {
    "action": "send",
    "threadId": "user_id",
    "message": "Hello from operis-api!"
  }
}
```

## Error Handling

```typescript
try {
  const result = await moltbotClientService.executeTools(toolCalls);
} catch (error) {
  if (error.message.includes("Moltbot API error")) {
    // Fallback to sub-agent
    return executeViaSubAgent(toolCall);
  }
  throw error;
}
```

## Security

- API Key authentication với Moltbot
- Tool execution permissions controlled by Moltbot
- Dangerous commands blocked tại Moltbot level
- Session isolation via sub-agents

## Testing

```bash
# Test Moltbot connection
curl -H "Authorization: Bearer $MOLTBOT_API_KEY" \
     -X POST http://localhost:3000/api/tools/execute \
     -d '{"tool":"web_search","parameters":{"query":"test"}}'

# Test via operis-api
curl -X POST http://localhost:8000/api/chat \
     -d '{"message":"mở google tìm kiếm AI"}'
```

## Benefits

✅ **No reimplementation** - dùng tools có sẵn của Moltbot  
✅ **Advanced automation** - browser forms, Zalo, etc.  
✅ **Scalability** - sub-agents cho complex tasks  
✅ **Security** - Moltbot handles dangerous operations  
✅ **Consistency** - same tools across all interfaces  

---

Giờ operis-api có thể làm được MỌI THỨ mà Moltbot làm được! 🚀