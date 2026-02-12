#!/bin/bash
# ============================================================
# Model Benchmark Script
# Tests 20 hard questions across all available models
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

# 20 Hard Questions: (id, category, question, expected_keyword)
QUESTIONS = [
    (1, "Math", "What is 97 * 103? Explain using the difference of squares formula (a-b)(a+b) = a^2 - b^2.", "9991"),
    (2, "Logic", "A farmer has 17 sheep. All but 9 die. How many sheep are left alive?", "9"),
    (3, "Coding", "Write a Python function to find the longest palindromic substring using Manacher's algorithm. Full implementation with O(n) complexity.", "def"),
    (4, "Science", "Explain why a mirror appears to reverse left and right but not up and down. Is this actually true? What does a mirror really reverse?", "front"),
    (5, "Trick", "If you have a bowl with six apples and you take away four, how many do you have?", "4"),
    (6, "System Design", "Design a rate limiter using the token bucket algorithm. Provide pseudocode that handles concurrent requests safely with thread locks.", "token"),
    (7, "Probability", "In the Monty Hall problem, should you switch doors? Calculate the exact probability for switching vs staying.", "2/3"),
    (8, "Lateral", "A man pushes his car to a hotel and tells the owner he is bankrupt. Why?", "monopoly"),
    (9, "SQL", "Write a SQL query to find the second highest salary from an Employees table. Do NOT use LIMIT, TOP, or window functions. Use subquery only.", "SELECT"),
    (10, "Vietnamese", "Giai thich su khac biet giua machine learning, deep learning va artificial intelligence. Cho vi du cu the cho moi loai.", "neural"),
    (11, "Calculus", "Find the derivative of f(x) = x^x for x > 0. Show all steps using logarithmic differentiation.", "ln"),
    (12, "Concurrency", "Explain the ABA problem in lock-free programming. Why is compare-and-swap (CAS) vulnerable to it? Provide a solution.", "tag"),
    (13, "Philosophy", "Explain the Chinese Room argument by John Searle. Does it successfully refute strong AI? Give arguments for and against.", "understand"),
    (14, "Security", "Explain how a timing side-channel attack works against string comparison for passwords. Write a constant-time comparison function.", "constant"),
    (15, "Number Theory", "Prove that the square root of 2 is irrational using proof by contradiction. Show every step clearly.", "contradiction"),
    (16, "Biology", "Explain how CRISPR-Cas9 works: how does it find specific DNA sequences? What is the guide RNA role? What are off-target effects?", "guide"),
    (17, "Distributed", "Explain the Raft consensus algorithm. How does leader election work? What happens during a network partition? Compare briefly with Paxos.", "leader"),
    (18, "Hard Logic", "You have 12 balls, one is heavier or lighter (unknown). You have a balance scale and can weigh 3 times. How do you find the odd ball and determine if heavier or lighter?", "weigh"),
    (19, "Performance", "Given an array of 1 million integers, find the kth largest. Compare sorting O(n log n), min-heap O(n log k), and quickselect O(n). Which is best?", "quickselect"),
    (20, "Creative", "Write a short story (max 150 words) with a hidden plot twist. The twist must be logically consistent with clues hidden in the story.", "twist"),
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
    medal = ["🥇", "🥈", "🥉", "4.", "5."][rank - 1]
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
