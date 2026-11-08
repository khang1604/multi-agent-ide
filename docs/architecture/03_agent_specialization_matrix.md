# Agent Specialization Matrix & Routing Taxonomy

## 1. Overview
The fundamental thesis of MAHub is that **no single model is optimal for all coding tasks**. Efficiency, accuracy, and cost-effectiveness require allocating tasks based on proven model strengths and cost curves.

---

## 2. Model & Agent Strengths Taxonomy

```
+-----------------------------------------------------------------------------------------+
|                                    MAHub Model Matrix                                   |
+----------------------+--------------------------+-----------------------+---------------+
| Model / Agent Family | Peak Strength            | Ideal Task Domain     | Relative Cost |
+----------------------+--------------------------+-----------------------+---------------+
| Claude 3.7 / Opus    | High-Horizon Reasoning,  | System Architecture,  | Premium       |
|                      | Refactoring Precision    | Hard Debugging, AppSec| ($$$)         |
+----------------------+--------------------------+-----------------------+---------------+
| Gemini 2.5 / 2.0 Pro | 2M Context Window,       | Full-Repo Audits,     | Moderate      |
|                      | Multimodal & Grounding   | Visual UI Review, RAG | ($$)          |
+----------------------+--------------------------+-----------------------+---------------+
| OpenAI o3-mini / 4o  | Algorithmic Rigor,       | Math/Algorithms,      | Moderate      |
|                      | Dense Logic Synthesis    | Strict JSON Schemas   | ($$)          |
+----------------------+--------------------------+-----------------------+---------------+
| Gemini 2.0 Flash /   | Blazing Latency,         | Triage, Linter Fixes, | Economy       |
| Claude Haiku 3.5     | Cheap Token Economics    | Docstrings, Routing   | ($)           |
+----------------------+--------------------------+-----------------------+---------------+
| DeepSeek R1 / V3     | Open-Weight Reasoning,   | Cost-effective Code,  | Low / Open    |
| & Qwen 2.5 Coder     | Offline / Self-Hosted    | Sensitive/Airgapped   | (Free-$)      |
+----------------------+--------------------------+-----------------------+---------------+
```

---

## 3. Detailed Profile by Family

### A. Claude Family (Anthropic — Sonnet 3.7 / Opus)
* **Superpower**: Adherence to nuanced architectural constraints, surgical diff generation, complex multi-file refactoring without breaking adjacent code, and adherence to security constitutions.
* **Best Fit in MAHub**:
  - `Lead Architect Agent`: Decomposing broad feature requests into unambiguous step-by-step plans.
  - `Code Reviewer / Gatekeeper`: Auditing pull requests, verifying AppSec invariants, enforcing Karpathy & Ponytail standards.
  - `Root Cause Investigator`: Solving non-reproducible or convoluted multi-layer bugs.

### B. Gemini Family (Google DeepMind — 2.5 / 2.0 Pro & Flash)
* **Superpower**: Unrivaled context capacity (up to 2,000,000 tokens), rapid multimodal processing (interpreting design mockups and UI screenshots), and deep grounding.
* **Best Fit in MAHub**:
  - `Repository Analyst`: Ingesting entire legacy codebases, large log files, and technical documentation in a single pass.
  - `Visual UI Tester`: Inspecting rendered screenshots from web/mobile apps to detect layout regressions.
  - `Fast Classifier (Flash)`: Serving as the Tier-1 routing dispatcher to categorize user intent in <200ms.

### C. OpenAI Family (o3-mini / GPT-4o)
* **Superpower**: High speed on deterministic logic puzzles, algorithmic optimizations, rigorous unit test generation.
* **Best Fit in MAHub**:
  - `Algorithm Worker`: Implementing complex data structures, state machines, and mathematical computations.
  - `Test Suite Generator`: Crafting comprehensive boundary and edge-case unit test suites.

### D. DeepSeek & Local Open Models (DeepSeek R1/V3, Qwen 2.5 Coder)
* **Superpower**: Strong coding performance with zero cloud token cost when run locally, or fractional cost via API; zero telemetry for private repositories.
* **Best Fit in MAHub**:
  - `Air-Gapped Worker`: Executing tasks on codebases containing sensitive business logic that cannot leave the local machine.
  - `Bulk Transformer`: Running mass migrations (e.g., Python 2 to 3, adding typing annotations to 500 files).

---

## 4. MAHub Dynamic Routing Matrix

| Task Category | Primary Assigned Agent | Fallback / Escalation Agent | Verification Criteria |
| :--- | :--- | :--- | :--- |
| **New Feature Architecture** | Claude 3.7 Sonnet | Claude Opus | PlanManifest passes schema + verification checklist |
| **Full Repo / Log Ingestion** | Gemini 2.5 Pro | Gemini 2.0 Flash | Structured JSON summary with exact file citations |
| **Algorithmic Module Coding** | OpenAI o3-mini | Claude 3.7 Sonnet | 100% unit test pass rate (`pytest`, `unittest`) |
| **Routine Fix / Linting** | Gemini 2.0 Flash / Qwen | DeepSeek V3 / Sonnet | Linter clean (`ruff`, `eslint`) + zero syntax error |
| **UI/UX Component & Design** | Gemini 2.5 (Multimodal) | Claude 3.7 Sonnet | Render match + WCAG 2.1 compliance |
| **Security Audit & Pen-Test** | Claude 3.7 (Hunter) | Adversarial Verifier | Demonstrable exploit path + zero false positives |
