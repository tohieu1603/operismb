/**
 * Tool Executor Service Tests
 */

import { toolExecutorService } from "../tool-executor.service";

describe("ToolExecutorService", () => {
  describe("executeSingleTool", () => {
    it("should execute browser tool correctly", async () => {
      const toolCall = {
        id: "test-1",
        function: {
          name: "browser",
          arguments: JSON.stringify({
            action: "open",
            targetUrl: "https://example.com",
          }),
        },
      };

      const results = await toolExecutorService.executeTools([toolCall]);
      
      expect(results).toHaveLength(1);
      expect(results[0].role).toBe("tool");
      expect(results[0].tool_call_id).toBe("test-1");
      
      const result = JSON.parse(results[0].content);
      expect(result.success).toBe(true);
      expect(result.url).toBe("https://example.com");
    });

    it("should handle exec tool safely", async () => {
      const toolCall = {
        id: "test-2", 
        function: {
          name: "exec",
          arguments: JSON.stringify({
            command: "echo hello",
          }),
        },
      };

      const results = await toolExecutorService.executeTools([toolCall]);
      
      expect(results).toHaveLength(1);
      const result = JSON.parse(results[0].content);
      expect(result.success).toBe(true);
      expect(result.stdout.trim()).toBe("hello");
    });

    it("should block dangerous commands", async () => {
      const toolCall = {
        id: "test-3",
        function: {
          name: "exec", 
          arguments: JSON.stringify({
            command: "rm -rf /",
          }),
        },
      };

      const results = await toolExecutorService.executeTools([toolCall]);
      
      expect(results).toHaveLength(1);
      const result = JSON.parse(results[0].content);
      expect(result.error).toContain("Dangerous command blocked");
    });

    it("should convert tool calls to blocks correctly", () => {
      const toolCalls = [
        {
          id: "test-4",
          function: {
            name: "browser",
            arguments: JSON.stringify({ action: "open", targetUrl: "https://test.com" }),
          },
        },
      ];

      const blocks = toolExecutorService.toolCallsToBlocks(toolCalls);
      
      expect(blocks).toHaveLength(1);
      expect(blocks[0].type).toBe("tool_use");
      expect(blocks[0].name).toBe("browser");
      expect(blocks[0].input).toEqual({ action: "open", targetUrl: "https://test.com" });
    });
  });
});