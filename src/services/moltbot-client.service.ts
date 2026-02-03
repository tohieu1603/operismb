/**
 * Moltbot Client Service
 * Calls Moltbot API to execute tools instead of implementing them ourselves
 */

interface MoltbotToolCall {
  tool: string;
  parameters: Record<string, any>;
}

interface MoltbotResponse {
  success: boolean;
  result?: any;
  error?: string;
}

class MoltbotClientService {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor() {
    this.baseUrl = process.env.MOLTBOT_API_URL || "http://localhost:3000";
    this.apiKey = process.env.MOLTBOT_API_KEY || "";
  }

  /**
   * Execute tools via Moltbot API
   */
  async executeTools(toolCalls: any[]): Promise<any[]> {
    const results: any[] = [];

    for (const toolCall of toolCalls) {
      try {
        const result = await this.executeSingleTool(toolCall);
        results.push({
          role: "tool",
          content: JSON.stringify(result),
          tool_call_id: toolCall.id,
        });
      } catch (error) {
        results.push({
          role: "tool",
          content: JSON.stringify({
            error: error instanceof Error ? error.message : "Unknown error",
            success: false,
          }),
          tool_call_id: toolCall.id,
        });
      }
    }

    return results;
  }

  /**
   * Execute single tool via Moltbot
   */
  private async executeSingleTool(toolCall: any): Promise<any> {
    const { name } = toolCall.function;
    const args = JSON.parse(toolCall.function.arguments);

    console.log(`[moltbot] Executing ${name} with args:`, args);

    // Map our tool calls to Moltbot's format
    const moltbotCall = this.mapToMoltbotCall(name, args);
    
    // Call Moltbot API
    const response = await this.callMoltbotAPI(moltbotCall);
    
    return {
      success: true,
      tool: name,
      result: response.result,
      message: `Successfully executed ${name}`,
    };
  }

  /**
   * Map our tool format to Moltbot's expected format
   */
  private mapToMoltbotCall(toolName: string, args: any): MoltbotToolCall {
    switch (toolName) {
      case "browser":
        return {
          tool: "browser",
          parameters: {
            action: "open",
            targetUrl: args.targetUrl,
          },
        };

      case "web_search":
        return {
          tool: "web_search", 
          parameters: {
            query: args.query,
            count: 5,
          },
        };

      case "exec":
        return {
          tool: "exec",
          parameters: {
            command: args.command,
          },
        };

      case "file_read":
        return {
          tool: "Read", // Moltbot's read tool
          parameters: {
            path: args.path,
          },
        };

      case "file_write":
        return {
          tool: "Write",
          parameters: {
            path: args.path,
            content: args.content,
          },
        };

      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }

  /**
   * Call Moltbot API endpoint
   */
  private async callMoltbotAPI(toolCall: MoltbotToolCall): Promise<MoltbotResponse> {
    try {
      // Option 1: Direct API call (if Moltbot has REST endpoint)
      const response = await fetch(`${this.baseUrl}/api/tools/execute`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(toolCall),
      });

      if (!response.ok) {
        throw new Error(`Moltbot API error: ${response.statusText}`);
      }

      return await response.json();
      
    } catch (error) {
      // Option 2: Use sessions_spawn để tạo sub-agent
      return this.executeViaSubAgent(toolCall);
    }
  }

  /**
   * Fallback: Execute via Moltbot sub-agent session
   */
  private async executeViaSubAgent(toolCall: MoltbotToolCall): Promise<MoltbotResponse> {
    // Tạo task string cho sub-agent
    const taskDescription = this.formatTaskForSubAgent(toolCall);
    
    // Spawn sub-agent (giả sử có API endpoint)
    const response = await fetch(`${this.baseUrl}/api/sessions/spawn`, {
      method: "POST", 
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        task: taskDescription,
        agentId: "main", // or specific agent ID
        cleanup: "delete", // Clean up after execution
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to spawn sub-agent: ${response.statusText}`);
    }

    const result = await response.json();
    
    return {
      success: true,
      result: result,
    };
  }

  /**
   * Format tool call as natural language task for sub-agent
   */
  private formatTaskForSubAgent(toolCall: MoltbotToolCall): string {
    const { tool, parameters } = toolCall;

    switch (tool) {
      case "browser":
        return `Mở trang web: ${parameters.targetUrl}`;
        
      case "web_search":
        return `Tìm kiếm Google với từ khóa: ${parameters.query}`;
        
      case "exec":
        return `Chạy lệnh terminal: ${parameters.command}`;
        
      case "Read":
        return `Đọc file: ${parameters.path}`;
        
      case "Write":
        return `Ghi vào file ${parameters.path} nội dung: ${parameters.content}`;
        
      default:
        return `Execute tool ${tool} with parameters: ${JSON.stringify(parameters)}`;
    }
  }
}

export const moltbotClientService = new MoltbotClientService();