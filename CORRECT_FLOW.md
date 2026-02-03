# Correct Integration Flow

## ✅ Flow đúng:

```
User input
    ↓
Moltbot receives message
    ↓  
Moltbot calls → Operis API (/chat endpoint)
    ↓
Operis calls → DeepSeek API
    ↓
DeepSeek returns → AI response with tool_calls
    ↓
Operis formats → Anthropic-style response with tool_use blocks
    ↓
Moltbot receives → tool_use blocks in response
    ↓
Moltbot executes → tools using its own tool system
    ↓
Moltbot continues → conversation with tool results
    ↓
Final response to user
```

## Role Separation:

### 🤖 **Operis API = AI Provider Only**
- Receive prompt from Moltbot
- Call DeepSeek API for AI inference  
- Return structured response with tool calls
- **NO tool execution** - chỉ provide intelligence

### 🔧 **Moltbot = Tool Executor & Orchestrator**  
- Send prompts to operis API
- Parse tool calls from AI response
- **Execute tools** using built-in tool system
- Continue conversation với tool results
- Handle complex multi-step automations

## Example:

### User: "mở youtube tìm kiếm cat videos"

**1. Moltbot → Operis API:**
```json
POST /chat
{
  "message": "mở youtube tìm kiếm cat videos",
  "conversationId": "uuid"
}
```

**2. Operis → DeepSeek → Operis Response:**
```json
{
  "content": [
    {
      "type": "text", 
      "text": "Tôi sẽ mở YouTube và tìm kiếm cat videos cho bạn."
    },
    {
      "type": "tool_use",
      "id": "toolu_abc123",
      "name": "browser", 
      "input": {
        "action": "open",
        "targetUrl": "https://youtube.com/results?search_query=cat+videos"
      }
    }
  ],
  "stop_reason": "tool_use"
}
```

**3. Moltbot executes tool:**
```typescript
// Moltbot's built-in browser tool
browser({
  action: "open",
  targetUrl: "https://youtube.com/results?search_query=cat+videos"  
})
```

**4. Moltbot continues conversation:**
- Tool execution thành công → "✅ Đã mở YouTube với kết quả tìm kiếm 'cat videos'"
- Tool execution fail → retry hoặc thông báo lỗi

## Configuration in Moltbot:

```yaml
# moltbot config
models:
  operis:
    provider: "http"
    endpoint: "http://localhost:8000/chat"
    apiKey: "your-api-key"
    format: "anthropic" # Expect Anthropic-style responses
```

## Benefits:

✅ **Separation of concerns** - AI vs Tool execution  
✅ **Leverage Moltbot ecosystem** - browser automation, Zalo, nodes, etc.  
✅ **Scalability** - operis focuses on AI, Moltbot handles infra  
✅ **Security** - dangerous operations controlled by Moltbot  
✅ **Complex workflows** - Moltbot can chain multiple tool calls  

## Advanced Example:

**User:** "login facebook với abc@gmail.com rồi post status hello world"

**Moltbot sẽ:**
1. Call operis API → get tool calls
2. Execute `browser(action="open", targetUrl="https://facebook.com")`  
3. Execute `browser(action="act", request={kind:"fill", selector:"#email", text:"abc@gmail.com"})`
4. Execute `browser(action="act", request={kind:"fill", selector:"#pass", text:"password"})`
5. Execute `browser(action="act", request={kind:"click", selector:"[name='login']"})`
6. Execute `browser(action="act", request={kind:"type", text:"hello world"})`
7. Execute `browser(action="act", request={kind:"click", selector:"[data-testid='react-composer-post-button']"})`

**Operis chỉ cần:**
- Đề xuất sequence of tool calls
- Không tự implement browser automation

---

Giờ operis-api chỉ là **AI brain**, Moltbot là **hands and feet**! 🧠🤝