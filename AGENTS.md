# Agent instructions

Read `ai/GLOBAL_RULES.md`, `ai/SECURITY.md`, and `ai/AGENTS.md` before working.
The repository root keeps this discovery entrypoint; the full AI instructions live in `ai/`.

## Core Project Definition & Strict Operating Invariants
1. **Dự án IDE tích hợp sâu (Deeply Integrated Multi-Agent IDE):**
   - Đây là một IDE tích hợp sâu dành cho Multi-Agent (bản build nguồn native từ Code-OSS/VSCodium), KHÔNG PHẢI LÀ MỘT EXTENSION THÔNG THƯỜNG.
   - Đây là dự án **điều phối agent (Multi-Agent Coordination & Orchestration)**. Mọi tác vụ đọc codebase, phân tích yêu cầu, lập kế hoạch (`PLAN.md`), sinh mã và kiểm thử phải do chính các AI Agent (Planner/Architect, Worker, Auditor) thực hiện. Hệ thống chỉ đóng vai trò điều phối hạ tầng và giao diện, tuyệt đối không được phép hardcode logic nghiệp vụ, regex phỏng đoán hoặc template giả lập để thay thế vai trò của Agent.

2. **Quy tắc bất biến: Không suy diễn - Phải hỏi trước khi làm:**
   - **Tuyệt đối không tự ý suy diễn (Zero Unverified Assumptions):** Không được phỏng đoán ý đồ của người dùng hay tự ý quyết định hướng đi khi chưa có sự xác nhận.
   - **Bắt buộc phải hỏi và làm rõ (Must Ask First):** Không tự ý làm bất cứ điều gì khi chưa hỏi hoặc chưa hiểu rõ yêu cầu. Khi có bất kỳ điểm nào chưa rõ hoặc đứng trước các quyết định điều chỉnh luồng điều phối, bắt buộc phải đặt câu hỏi trực tiếp và chỉ hành động sau khi người dùng xác nhận rõ ràng.

The operator explicitly authorized direct edits in this primary checkout.
Do not create extra worktrees unless the operator requests them. Preserve user changes and all other security boundaries.
