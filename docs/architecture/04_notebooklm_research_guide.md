# Phase 1: NotebookLM Research & Grounding Workflow

## 1. Purpose of Phase 1
Before writing low-level code for the multi-agent routing engine, Phase 1 focuses on deep architectural research and design validation. Using **Google NotebookLM** grounded by our research documents ensures:
1. **Zero Hallucination**: Every architectural decision is backed by citations from our research corpus.
2. **Synthetic Debate & Review**: Using Gemini 2.5 inside NotebookLM to probe weak spots in the orchestration protocol.
3. **Audio Overview**: Generating podcast-style audio discussions to review trade-offs between dynamic routing strategies on the go.

---

## 2. Step-by-Step Workflow

### Step 1: Initialize the NotebookLM Research Space
1. Go to [https://notebooklm.google.com](https://notebooklm.google.com) on your browser.
2. Click **Create new notebook** (Tạo sổ tay mới).
3. Name the notebook: `MAHub Architecture & Routing Research`.

### Step 2: Ingest Research Sources
Upload the markdown files located in `/home/nguyenkhang/Project/mahub/.local/docs/`:
* `01_orchestrator_vision_and_core_concepts.md`
* `02_competitive_analysis_and_benchmarks.md`
* `03_agent_specialization_matrix.md`
*(Optional: Also upload PDFs or URLs of relevant research papers: RouteLLM, FrugalGPT, MetaGPT).*

### Step 3: Link Notebook into MAHub via MCP
Once your notebook is created in Google NotebookLM:
1. Copy the URL from your browser address bar:
   `https://notebooklm.google.com/notebook/<your-notebook-uuid>`
2. Tell MAHub / Antigravity:
   > *"Add this notebook to my research library: `<your-notebook-url>` and set it as active."*

### Step 4: Conduct Grounded Q&A via MCP
Use the MCP server to ask complex design questions directly from your coding assistant:
* *"Based on our agent specialization matrix, how should MAHub handle a task that combines visual UI debugging and low-level algorithmic optimization?"*
* *"What lessons from 9-route prevent cost overruns when running automated test-fix loops?"*
* *"Draft the exact JSON schema for an Agent Manifest adhering to the SAI (Standardized Agent Interface) specifications in doc 01."*

### Step 5: Audio Overview Generation
Trigger podcast generation to hear an interactive audio discussion of the design:
* Command via agent: *"Generate an Audio Overview for the MAHub research notebook."*
* Once complete, download the `.m4a` file directly into your local machine using `download_audio`.
