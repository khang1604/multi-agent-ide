# Deeply Integrated Multi-Agent IDE — Core Charter & Operating Rules

Read `ai/GLOBAL_RULES.md`, `ai/SECURITY.md`, and `ai/AGENTS.md` before working.
The repository root keeps this discovery entrypoint; the full AI instructions live in `ai/`.

---

## 1. Bản Chất Dự Án: Deeply Integrated Multi-Agent IDE (KHÔNG PHẢI EXTENSION)
- **Định nghĩa:** Đây là một IDE tích hợp sâu dành cho Multi-Agent (bản build nguồn native từ Code-OSS/VSCodium), **KHÔNG PHẢI LÀ MỘT EXTENSION THÔNG THƯỜNG**.
- **Chức năng:** Đây là dự án **điều phối agent (Multi-Agent Coordination & Orchestration)**. Mọi tác vụ đọc codebase, phân tích yêu cầu, lập kế hoạch (`PLAN.md`), sinh mã và kiểm thử phải do chính các AI Agent (Planner/Architect, Worker, Auditor) thực hiện.
- **Phân tầng kiến trúc 3 lớp (Three-Tier Native Architecture):**
  1. **Tầng Native Shell (`vscode/src/vs/`):** Code-OSS bản build native. Khởi động mặc định không gian làm việc Cockpit 3 cột (Cột 1: Living Plan `PLAN.md`, Cột 2: Continuous Multi-Diff Staging, Cột 3: Swarm Activity Stream/Chat) và tích hợp sâu `MultiDiffEditor`.
  2. **Tầng Built-in Core Controller (`src/stable/extensions/multi-agent-harness`):** Module điều khiển lõi tích hợp sẵn, làm cầu nối IPC giữa giao diện IDE và Python Kernel, quản lý Webview chat, Status HUD, và đồng bộ dữ liệu thời gian thực.
  3. **Tầng Orchestration Kernel (`harness/`):** Động cơ điều phối Python trung tâm, quản lý SQLite store, Git worktree độc lập, context packing, và gọi thực thi các tiến trình CLI Agent thật (`agy`, `claude`, `codex`, `copilot`).

---

## 2. Quy Tắc Hành Xử Bất Biến (Strict Operating Invariants)
- **TUYỆT ĐỐI KHÔNG TỰ Ý SUY DIỄN (Zero Unverified Assumptions):**
  Không được phỏng đoán ý đồ của người dùng hay tự ý quyết định hướng đi khi chưa có sự xác nhận.
- **BẮT BUỘC PHẢI HỎI VÀ LÀM RÕ (Must Ask First):**
  Không tự ý làm bất cứ điều gì khi chưa hỏi hoặc chưa hiểu rõ yêu cầu. Khi có bất kỳ điểm nào chưa rõ hoặc đứng trước các quyết định điều chỉnh luồng điều phối, bắt buộc phải đặt câu hỏi trực tiếp và chỉ hành động sau khi người dùng xác nhận rõ ràng.
- **TUYỆT ĐỐI KHÔNG GIẢ LẬP / HARDCODE (No Mocking / Zero Hardcoded Business Logic):**
  Hệ thống IDE chỉ đóng vai trò hạ tầng điều phối và hiển thị. Tuyệt đối cấm hardcode logic nghiệp vụ, regex phỏng đoán câu lệnh (`isLogin`, `isSettings`,...) hoặc các template code tĩnh để thay thế vai trò của Agent.

---

## 3. Quy Trình Điều Phối Chuẩn (Agent Coordination Pipeline)
Khi người dùng nhập yêu cầu (objective) trong khung chat Swarm:
1. **Chuyển giao (Dispatch):** IDE gửi mục tiêu trực tiếp sang Python Hub Daemon (`harness/cli/hub.py run`).
2. **Kế hoạch (Planner / Architect Agent):**
   - Daemon cung cấp ngữ cảnh lai (Hybrid Context: Context Pack ban đầu + quyền đọc file qua CLI sandbox).
   - Planner CLI thực sự (`agy`, `claude`, `codex`, `copilot` theo cấu hình) đọc codebase, phân tích độ phức tạp, đề xuất giải pháp, phân rã checklist công việc, chỉ định Worker Agent và xác lập Tiêu chí nghiệm thu (Acceptance Criteria).
   - Xuất ra file `PLAN.md` chuẩn, lưu trữ tại thư mục quản lý riêng của IDE (`~/.multi-agent-ide/brain/<project>/PLAN.md` hoặc `.local/PLAN.md`) và tự động hiển thị ở Cột 1 (Living Plan).
3. **Cổng kiểm soát người dùng (Human-in-the-Loop Approval Gate):**
   - Mặc định hiển thị nút **Duyệt kế hoạch (Approve Plan)** để người dùng kiểm tra `PLAN.md` trước khi Worker bắt đầu viết mã.
   - Có tùy chọn bật **Autopilot Mode** để tự động chuyển tiếp khi người dùng cần tốc độ.
4. **Thực thi mã nguồn (Worker Agent):**
   - Worker Agent (được chỉ định bởi Planner hoặc Role Mapping) đọc `PLAN.md` và viết mã trong Git worktree biệt lập (`.local/worktrees/<task-id>/`) hoặc staging directory, không làm ô nhiễm thư mục làm việc chính.
5. **Kiểm tra đa tầng (Auditor Agent Verification):**
   - Auditor Agent kiểm tra cú pháp AST/TypeScript (bắt lỗi gạch đỏ, unused imports, type mismatch), rà soát bảo mật (không rò rỉ secret, tuân thủ rule bất biến) và đối chiếu với Tiêu chí nghiệm thu trong `PLAN.md`.
6. **Xem xét và Hợp nhất (Continuous Multi-Diff Review):**
   - Hiển thị toàn bộ các file thay đổi cùng lúc trên Continuous Multi-Diff Editor ở Cột 2 để người dùng duyệt từng chunk hoặc chấp nhận merge vào mã nguồn chính.

---

## 4. Tiến Độ & Trạng Thái Thực Tế (Realtime Event Streaming)
- Toàn bộ bước suy nghĩ ("Thinking...") và thông tin trạng thái hiển thị trên giao diện IDE phải được stream từ các sự kiện thực tế (events) do Python Hub Daemon và các CLI Agent phát ra.
- Tuyệt đối cấm sử dụng `setTimeout` giả lập hoặc bịa đặt tiến trình thinking trong mã nguồn IDE.

---

## 5. Chính Sách Tài Khoản & Xác Thực (Authentication Hierarchy)
- **Ưu tiên 1:** Sử dụng tài khoản CLI chính chủ qua OAuth/session native (`agy`, `claude login`, `codex login`, `copilot login`).
- **Ưu tiên 2:** Chỉ khi tài khoản CLI chưa đăng nhập hoặc gặp lỗi quota/hạn ngạch thì mới cho phép fallback sang API Key nếu được cấu hình trong Settings.

---

The operator explicitly authorized direct edits in this primary checkout.
Do not create extra worktrees unless the operator requests them. Preserve user changes and all other security boundaries.
