#!/bin/bash
# ============================================================
# OpenClaw Model Benchmark Script
# Tests 20 tasks (10 categories × 2) based on OpenClaw system capabilities
# Models: deepseek-chat, kimi-k2.5, kimi-k2-thinking, gpt-oss-120b, glm-4.7, seed-code
# via OpenClaw gateway at localhost:3000
# ============================================================

set -euo pipefail

RESULTS_DIR="./benchmark-results"
mkdir -p "$RESULTS_DIR"

# Get gateway token
GW_TOKEN=$(python3 -c "import json; d=json.load(open('$HOME/.openclaw/openclaw.json')); print(d.get('gateway',{}).get('auth',{}).get('token',''))")

echo "============================================"
echo " Model Benchmark - $(date '+%Y-%m-%d %H:%M')"
echo "============================================"

# Run the actual benchmark in Python for safe JSON handling
python3 << 'PYEOF'
import json, time, os, sys, subprocess

GATEWAY_URL = "http://localhost:3000"
_home = os.path.expanduser("~")
_cfg = json.load(open(os.path.join(_home, ".openclaw/openclaw.json")))
GW_TOKEN = _cfg.get("gateway", {}).get("auth", {}).get("token", "")
RESULTS_DIR = "./benchmark-results"
TIMEOUT = 120
MAX_TOKENS = 2048

MODELS = [
    "deepseek-chat",
    "byteplus/kimi-k2.5",
    "byteplus/kimi-k2-thinking",
    "byteplus/gpt-oss-120b",
    "byteplus/glm-4.7",
    "byteplus/bytedance-seed-code",
]

# ============================================================
# 20 Workflow Tasks — Basic → Intermediate → Advanced
# Based on actual OpenClaw user workflows:
#   Basic (1-6):       Simple chat, Q&A, Vietnamese, basic code
#   Intermediate (7-14): Coding, summarize, content, data extraction
#   Advanced (15-20):   Multi-step, tool calls, complex constraints
# ============================================================

QUESTIONS = [
    # ======== BASIC WORKFLOWS (1-6) ========
    # WF1: Simple greeting & Q&A — user sends casual question via Telegram/Zalo
    (1, "WF-Basic", "Xin chao! Toi la Minh. Ban co the gioi thieu ban than va cho toi biet hom nay la thu may khong?", "Minh"),

    # WF2: Simple knowledge query — user asks factual question
    (2, "WF-Basic", "What are the 3 main differences between REST and GraphQL APIs? Answer in a numbered list, keep each point under 25 words.", "GraphQL"),

    # WF3: Basic Vietnamese conversation — natural VN chat
    (3, "WF-Basic", "Giai thich cho toi hieu 'container' va 'virtual machine' khac nhau nhu the nao, dung vi du don gian nhu giai thich cho nguoi moi hoc lap trinh.", "container"),

    # WF4: Simple code explanation — user asks to explain code snippet
    (4, "WF-Basic", "Explain what this code does in simple terms:\n```javascript\nconst pipe = (...fns) => x => fns.reduce((v, f) => f(v), x);\n```\nGive one example of how to use it.", "reduce"),

    # WF5: Quick translation — user sends message to translate for channel
    (5, "WF-Basic", "Dich doan van sau sang tieng Anh chuyen nghiep:\n'Chung toi xin thong bao he thong se bao tri tu 22h ngay 15/02/2026 den 6h ngay 16/02/2026. Trong thoi gian nay, dich vu se tam ngung hoat dong. Xin loi vi su bat tien.'", "maintenance"),

    # WF6: Simple formatting — user asks to format data
    (6, "WF-Basic", "Format this data as a markdown table:\nName: Minh, Role: Backend Dev, Team: Platform\nName: Lan, Role: Frontend Dev, Team: Product\nName: Duc, Role: DevOps, Team: Infrastructure", "| Minh"),

    # ======== INTERMEDIATE WORKFLOWS (7-14) ========
    # WF7: Write a function — coding-agent workflow
    (7, "WF-Mid", "Write a complete TypeScript function called `debounce<T>` that:\n- Takes a callback function and delay (ms)\n- Returns a debounced version\n- Preserves `this` context\n- Has proper generic typing\n- Include JSDoc comment\nOutput only the code.", "debounce"),

    # WF8: Debug code — user pastes buggy code
    (8, "WF-Mid", "This Python function is supposed to merge two sorted lists but has a bug. Find and fix it:\n```python\ndef merge_sorted(a, b):\n    result = []\n    i = j = 0\n    while i < len(a) and j < len(b):\n        if a[i] <= b[j]:\n            result.append(a[i])\n            i += 1\n        else:\n            result.append(b[j])\n            j += 1\n    return result\n```\nExplain the bug and provide the corrected code.", "remaining"),

    # WF9: Summarize content — user sends long text for summary
    (9, "WF-Mid", "Summarize this in exactly 3 bullet points (max 20 words each):\n\nKubernetes is an open-source container orchestration platform that automates deploying, scaling, and managing containerized applications. It groups containers into pods for easy management. It provides self-healing - restarts failed containers, replaces containers when nodes die, and kills unresponsive containers. It offers horizontal scaling manually or automatically based on CPU. Service discovery and load balancing are built-in via DNS or IP. It manages storage orchestration with automatic mounting.", "pod"),

    # WF10: Write professional content — user asks bot to draft message for channel
    (10, "WF-Mid", "Write a Telegram bot welcome message for an AI assistant called 'OpenClaw'. Requirements:\n- Greet the user warmly\n- Explain 3 key features: coding help, task automation, multi-language support\n- Use emoji appropriately\n- End with a call-to-action\n- Max 120 words\n- Tone: friendly but professional", "OpenClaw"),

    # WF11: Data extraction — user sends raw text, wants structured JSON
    (11, "WF-Mid", "Extract structured data from this text as JSON with fields {name, role, company, action, deadline}:\n\n'Hi team, this is Nguyen Van A from VNG Corporation. As the lead DevOps engineer, I need everyone to complete the CI/CD pipeline migration to GitHub Actions by March 15th, 2026.'", "Nguyen"),

    # WF12: Vietnamese technical explanation — explain tech concept in VN
    (12, "WF-Mid", "Giai thich khai niem 'Infrastructure as Code' bang tieng Viet cho developer moi. Bao gom:\n1. Dinh nghia don gian\n2. Tai sao can dung\n3. Vi du cu the voi Docker Compose\n4. So sanh truoc/sau khi dung IaC\nGiu ngan gon, toi da 200 tu.", "Docker"),

    # WF13: API error analysis — user sends error, asks for fix
    (13, "WF-Mid", "Analyze this API error and suggest 3 specific fixes:\n```json\n{\"status\": 429, \"error\": \"Too Many Requests\", \"headers\": {\"retry-after\": \"30\", \"x-ratelimit-limit\": \"100\", \"x-ratelimit-remaining\": \"0\"}, \"body\": {\"message\": \"Rate limit exceeded. Implement exponential backoff.\"}}\n```", "backoff"),

    # WF14: Log parsing — user asks bot to parse and analyze logs
    (14, "WF-Mid", "Parse this nginx log and extract as JSON {ip, method, path, status, response_time_ms}:\n```\n103.216.82.15 - - [12/Feb/2026:14:23:45 +0700] \"POST /v1/chat/completions HTTP/1.1\" 200 4523 \"-\" \"Mozilla/5.0\" 0.847\n```\nAlso: is this request healthy? Why or why not?", "103.216"),

    # ======== ADVANCED WORKFLOWS (15-20) ========
    # WF15: Multi-step deployment plan — complex reasoning
    (15, "WF-Adv", "Design a zero-downtime deployment plan for a Node.js app with PostgreSQL and Redis dependencies. Requirements:\n- Blue-green deployment\n- Database migration safety\n- Rollback strategy\n- Health check verification\nProvide exactly 7 ordered steps. Each step must include: action, risk, and rollback plan.", "migration"),

    # WF16: Tool call generation — model must generate structured tool calls
    (16, "WF-Adv", "You are an AI assistant with these tools:\n- send_message(channel: string, text: string) — send to chat channel\n- web_fetch(url: string) — fetch URL content\n- set_reminder(time: string, message: string) — schedule reminder\n- exec_command(command: string) — run shell command\n\nUser request: 'Check if our API at https://api.example.com/health is up. If it responds, send a summary to #monitoring channel. Also remind me in 1 hour to check again.'\n\nGenerate the tool calls as a JSON array with proper parameters. Output ONLY valid JSON.", "send_message"),

    # WF17: Complex cron + math — automation workflow
    (17, "WF-Adv", "I have 3 cron jobs:\n- Job A: runs every 15 minutes (*/15 * * * *)\n- Job B: runs at minute 0 every hour (0 * * * *)\n- Job C: runs at 00:00 daily (0 0 * * *)\n\nCalculate:\n(a) Total executions in 24 hours for each job\n(b) Total combined executions\n(c) At what times do Job A and Job B execute simultaneously?\n(d) Write a single cron expression that would run at the same times as Job A but skip the times when Job B runs.\nShow all work.", "96"),

    # WF18: Full feature implementation — coding-agent advanced workflow
    (18, "WF-Adv", "Implement a complete TypeScript rate limiter class using the token bucket algorithm:\n- Constructor takes: maxTokens, refillRate (tokens/sec), refillInterval (ms)\n- Method `tryConsume(tokens: number): boolean` — returns true if allowed\n- Method `getStatus(): {available: number, max: number, nextRefill: number}`\n- Must be thread-safe for concurrent calls\n- Include full type definitions\n- Include usage example\nOutput production-ready code only.", "tryConsume"),

    # WF19: Multi-constraint formatting — strict instruction following
    (19, "WF-Adv", "Follow ALL rules EXACTLY:\n1. Start response with 'REPORT:'\n2. Write a 3-row markdown table with columns: Model, Speed, Quality, Cost\n3. Row 1: GPT-4o, Fast, High, $$$\n4. Row 2: Claude, Medium, Very High, $$\n5. Row 3: DeepSeek, Fast, Good, $\n6. After the table, write exactly one sentence summary\n7. End with 'END_REPORT'\n8. Do NOT include any other text before REPORT: or after END_REPORT", "REPORT:"),

    # WF20: Vietnamese complex task — advanced VN workflow
    (20, "WF-Adv", "Viet mot ban ke hoach ky thuat (technical plan) bang tieng Viet de chuyen doi he thong tu monolith sang microservices. Yeu cau:\n1. Chia thanh 5 giai doan cu the\n2. Moi giai doan co: muc tieu, cong viec chinh, rui ro, thoi gian uoc tinh\n3. Dinh dang bang markdown table\n4. Bao gom cac dich vu: Auth, Payment, Notification, Order\n5. Tong thoi gian khong qua 6 thang\nChi xuat markdown, khong giai thich them.", "microservice"),
]

import urllib.request

def call_model(model, question, q_id):
    """Call gateway API and return result dict."""
    payload = json.dumps({
        "model": model,
        "messages": [{"role": "user", "content": question}],
        "stream": False,
        "max_tokens": MAX_TOKENS,
    }).encode("utf-8")

    req = urllib.request.Request(
        f"{GATEWAY_URL}/v1/chat/completions",
        data=payload,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {GW_TOKEN}",
        },
        method="POST",
    )

    start = time.time()
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
            body = json.loads(resp.read().decode("utf-8"))
            elapsed = round(time.time() - start, 2)
            content = body.get("choices", [{}])[0].get("message", {}).get("content", "")
            tokens = body.get("usage", {}).get("total_tokens", 0)
            model_used = body.get("model", model)
            return {
                "status": "OK",
                "content": content,
                "tokens": tokens,
                "time": elapsed,
                "model_used": model_used,
            }
    except Exception as e:
        elapsed = round(time.time() - start, 2)
        return {
            "status": f"FAIL: {str(e)[:80]}",
            "content": "",
            "tokens": 0,
            "time": elapsed,
            "model_used": model,
        }

# ---- Run benchmark ----
all_results = []  # list of dicts

for model in MODELS:
    short = model.split("/")[-1]
    print(f"\n{'━' * 50}")
    print(f"  Model: {model}")
    print(f"{'━' * 50}")

    for q_id, category, question, keyword in QUESTIONS:
        result = call_model(model, question, q_id)
        has_kw = keyword.lower() in result["content"].lower() if result["status"] == "OK" else False

        icon = "✓" if has_kw else ("△" if result["status"] == "OK" else "✗")
        print(f"  {icon} Q{q_id:02d} [{category:12s}] {result['time']:6.1f}s | {result['tokens']:6d} tok | kw:{('YES' if has_kw else 'NO'):3s}")

        all_results.append({
            "model": model,
            "q_id": q_id,
            "category": category,
            "question": question[:60],
            "keyword": keyword,
            "status": result["status"],
            "has_keyword": has_kw,
            "time": result["time"],
            "tokens": result["tokens"],
            "content_preview": result["content"][:200],
        })

        # Save individual response
        safe_model = model.replace("/", "_")
        with open(f"{RESULTS_DIR}/{safe_model}_q{q_id:02d}.json", "w") as f:
            json.dump({"model": model, "q_id": q_id, "category": category, "result": result}, f, indent=2, ensure_ascii=False)

        time.sleep(1)  # Rate limit

# ---- Save raw data ----
with open(f"{RESULTS_DIR}/all-results.json", "w") as f:
    json.dump(all_results, f, indent=2, ensure_ascii=False)

# ---- Generate report ----
models = MODELS
lines = []
lines.append("# Model Benchmark Report\n")
lines.append(f"**Date:** {time.strftime('%Y-%m-%d %H:%M')}")
lines.append(f"**Questions:** {len(QUESTIONS)} | **Models:** {len(models)}")
lines.append(f"**Gateway:** localhost:3000 (OpenClaw → BytePlus)")
lines.append(f"**Max tokens:** {MAX_TOKENS}\n")

# Summary
lines.append("## Overall Ranking\n")
lines.append("| # | Model | API OK | Keyword Hit | Score | Avg Time | Total Tokens |")
lines.append("|---|-------|--------|-------------|-------|----------|--------------|")

model_stats = {}
for m in models:
    m_rows = [r for r in all_results if r["model"] == m]
    ok = sum(1 for r in m_rows if r["status"] == "OK")
    kw = sum(1 for r in m_rows if r["has_keyword"])
    total_t = sum(r["time"] for r in m_rows)
    total_tok = sum(r["tokens"] for r in m_rows)
    avg_t = total_t / len(m_rows) if m_rows else 0
    score = round((kw / len(m_rows)) * 100, 1) if m_rows else 0
    model_stats[m] = {"ok": ok, "kw": kw, "score": score, "avg_t": round(avg_t, 1), "total_tok": total_tok}

for rank, m in enumerate(sorted(models, key=lambda x: -model_stats[x]["score"]), 1):
    s = model_stats[m]
    short = m.split("/")[-1]
    medal = ["🥇", "🥈", "🥉", "4.", "5.", "6."][rank - 1]
    lines.append(f"| {medal} | **{short}** | {s['ok']}/20 | {s['kw']}/20 | **{s['score']}%** | {s['avg_t']}s | {s['total_tok']:,} |")

# Per-question detail matrix
lines.append("\n## Per-Question Matrix\n")
short_names = [m.split("/")[-1] for m in models]
header = "| Q# | Category | " + " | ".join(short_names) + " |"
sep = "|:---:|:--------:" + "|:---:" * len(models) + "|"
lines.append(header)
lines.append(sep)

for q_id, category, _, _ in QUESTIONS:
    row = f"| {q_id} | {category} |"
    for m in models:
        r = next((x for x in all_results if x["model"] == m and x["q_id"] == q_id), None)
        if not r:
            row += " - |"
        elif r["status"] != "OK":
            row += " ✗ |"
        elif r["has_keyword"]:
            row += f" ✓ {r['time']}s |"
        else:
            row += f" △ {r['time']}s |"
    lines.append(row)

lines.append("\n**Legend:** ✓ correct (keyword found) | △ answered, keyword missing | ✗ API error\n")

# Speed comparison
lines.append("## Speed Comparison\n")
lines.append("| Model | Min | Max | Avg | Median |")
lines.append("|-------|-----|-----|-----|--------|")
for m in models:
    m_rows = [r for r in all_results if r["model"] == m and r["status"] == "OK"]
    if m_rows:
        times = sorted([r["time"] for r in m_rows])
        short = m.split("/")[-1]
        median = times[len(times) // 2]
        lines.append(f"| {short} | {min(times)}s | {max(times)}s | {round(sum(times)/len(times),1)}s | {median}s |")

# Category breakdown
lines.append("\n## Category Breakdown\n")
cats = sorted(set(q[1] for q in QUESTIONS))
cat_header = "| Model | " + " | ".join(cats) + " |"
cat_sep = "|-------" + "|:---:" * len(cats) + "|"
lines.append(cat_header)
lines.append(cat_sep)
for m in models:
    short = m.split("/")[-1]
    row = f"| {short} |"
    for cat in cats:
        cat_rows = [r for r in all_results if r["model"] == m and r["category"] == cat]
        kw_hits = sum(1 for r in cat_rows if r["has_keyword"])
        total = len(cat_rows)
        row += f" {kw_hits}/{total} |"
    lines.append(row)

lines.append("")

report = "\n".join(lines)
with open(f"{RESULTS_DIR}/benchmark-report.md", "w") as f:
    f.write(report)

print(f"\n{'=' * 50}")
print(f" BENCHMARK COMPLETE")
print(f"{'=' * 50}")
print(f" Report: {RESULTS_DIR}/benchmark-report.md")
print(f" Raw data: {RESULTS_DIR}/all-results.json")
print(f" Individual: {RESULTS_DIR}/<model>_q<N>.json")
print(f"{'=' * 50}")

# Print quick summary
print(f"\n QUICK RANKING:")
for rank, m in enumerate(sorted(models, key=lambda x: -model_stats[x]["score"]), 1):
    s = model_stats[m]
    short = m.split("/")[-1]
    bar = "█" * int(s["score"] / 5) + "░" * (20 - int(s["score"] / 5))
    print(f"  {rank}. {short:25s} {bar} {s['score']}% ({s['kw']}/20 keyword hits)")

PYEOF

echo ""
echo "Done! View: cat ./benchmark-results/benchmark-report.md"
