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
- **CẤM ĐỒNG TÌNH MÙ QUÁNG & BẮT BUỘC PHẢI PHẢN BIỆN KỸ THUẬT (Zero Blind Agreement & Rigorous Technical Pushback):**
  Mỗi khi người dùng nêu ra một ý kiến, giải pháp hoặc đề xuất, tuyệt đối không được đồng tình một cách mù quáng hay gật đầu chấp thuận quá mức. Nếu ý kiến có bất kỳ lỗ hổng nào (lỗi logic, rủi ro bảo mật, suy giảm hiệu năng, vi phạm kiến trúc, giả định sai lệch hay phương án kém tối ưu), Agent BẮT BUỘC phải thẳng thắn phản bác, chỉ ra chính xác các điểm yếu/hệ quả và đưa ra phương án điều chỉnh chuẩn xác. Thứ người dùng cần là sự chính xác tuyệt đối trong công việc, không phải những lời công nhận hay khen ngợi sáo rỗng.

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

## 6. Ngôn Ngữ Mặc Định Của IDE Là 100% Tiếng Anh (Strict English-Only Invariant)
- **Quy tắc tuyệt đối:** Toàn bộ giao diện người dùng của IDE (UI labels, button text, input placeholders, thinking step descriptions, agent messages, status banners, system notices) **BẮT BUỘC PHẢI LÀ 100% TIẾNG ANH (ENGLISH)**.
- **Tuyệt đối cấm:** KHÔNG ĐƯỢC chèn tiếng Việt vào mã nguồn IDE, nhãn UI, chuỗi hiển thị, hoặc nội dung tin nhắn do Agent phát ra trong Swarm Chat / Control View.
- **Phân định ranh giới ngôn ngữ:** Trao đổi giữa Assistant và Người dùng trong cửa sổ chat lập trình dùng Tiếng Việt; toàn bộ sản phẩm IDE, mã nguồn, commit, UI text và Agent chatter trong IDE phải là Tiếng Anh.

---

## 7. Nghiệm Thu Hoàn Thành Tác Vụ Thuộc Về Agent Audit (Auditor Completion Protocol)
- **Quy tắc phán quyết:** Báo cáo tổng kết và câu trả lời hoàn thành tác vụ (`status: 'completed'`) **BẮT BUỘC PHẢI DO AGENT AUDIT TRẢ LỜI TRỰC TIẾP** dựa trên báo cáo nghiệm thu thực tế (`audit_report.json` / `AUDIT_REPORT.md`), bao gồm phán quyết (`VERDICT`), đánh giá (`SUMMARY`), và danh sách phát hiện (`FINDINGS`).
- **Tuyệt đối cấm thông báo giả:** Cấm phát sinh các tin nhắn hệ thống giả lập hoặc hardcode kết quả nghiệm thu khi chưa có phán quyết từ Auditor Agent.
- **Tuân thủ quy tắc bất biến:** Cấm phớt lờ các yêu cầu tổng quan hệ thống của người dùng hoặc tự ý suy diễn hành động khi chưa được xác nhận.

---

## 8. Tiêu Chuẩn Giao Diện Khung Chat Antigravity (Antigravity Chat UI Standards)
- **Thiết kế Borderless tối giản:** Toàn bộ khung chat loại bỏ mọi viền hộp thô kệch (`border: none`, `background: transparent / rgba(255,255,255,0.02)`), typography chuẩn (`13px`, line-height `1.6`, font chữ mượt mà).
- **Bong bóng tin nhắn người dùng:** Bo góc mềm mại (`border-radius: 12px 12px 2px 12px`), nền tối mờ cao cấp (`#1e2638`), canh phải.
- **Tiến trình suy nghĩ (Thinking Accordion):** Thiết kế accordion thu gọn/mở rộng mượt mà (`Thinking (Xs) ⌵`) kèm đường timeline mảnh bên trái (`1.5px solid rgba(148, 163, 184, 0.25)`), stream trực tiếp các bước suy nghĩ thực tế từ Agent và token/thời gian thực thi.
- **Khung nhập lệnh (Floating Input Card):** Thiết kế dạng capsule/card nổi ở đáy, bo góc `12px`, hiệu ứng viền mờ, hỗ trợ auto-expand theo nội dung, phím tắt `Ctrl+Enter` gửi lệnh, và nút gửi bo tròn hiện đại.
- **Thanh trạng thái Agent Swarm (HUD Swimlanes):** Các thẻ capsule pill hiển thị trạng thái động của Lead Architect, Worker, Auditor (`IDLE`, `PLANNING`, `EXECUTING`, `REVIEWING`).

---

## 9. Cơ Chế Điều Phối Độc Lập & Bất Biến Không Gian Làm Việc (Universal Workspace Dispatch)
- **Tuyệt đối cấm dùng đường dẫn tương đối trong lệnh điều phối:** Khi dispatch nhiệm vụ từ IDE, BẮT BUỘC phải dùng đường dẫn tuyệt đối tới CLI Kernel (`<IDE_ROOT>/harness/cli/hub.py`) và thiết lập `PYTHONPATH=<IDE_ROOT>/harness` cùng `PATH` đầy đủ.
- **Tự động đăng ký không gian làm việc (Dynamic Workspace Identification):** IDE phải tự động xác định và đăng ký workspace đang mở của người dùng trong SQLite Hub Store (`hub.py here --verify ...`) thay vì hardcode tên project là `default`.
- **Thực thi IPC trực tiếp và giám sát tiến trình:** Luồng điều phối phải kiểm tra mã thoát (exit code), stream logs lỗi ngay lập tức về UI nếu tiến trình gặp sự cố, tuyệt đối không được để giao diện im lặng chờ đợi khi lệnh điều phối bị lỗi.

---

## 10. Chợ Tiện Ích Độc Lập Open VSX (Open VSX Marketplace Invariant)
- **Nguồn extension chính thức:** Sử dụng Open VSX Registry (`https://open-vsx.org/vscode/gallery`) làm kho extension mặc định theo đúng lựa chọn của người dùng.
- **Hiển thị đầy đủ danh mục khám phá:** Chợ extension trong IDE không được để trống khi mới mở. Bắt buộc hiển thị danh sách extensions phổ biến (`Popular`), đề xuất (`Recommended`) và cho phép tìm kiếm, cài đặt mượt mà từ Open VSX.

---

## 11. Bảo Toàn Toàn Bộ Tính Năng Đã Viết Sẵn (Preserve & Reconnect Pre-existing Features)
- **Tận dụng mã nguồn đã viết:** Các tính năng quản lý Provider, Doctor health check, CLI login (`agy`, `copilot login`, `codex login`, `claude login`), API Key fallback, Staging action bar đã được xây dựng sẵn trong lịch sử repository. Nhiệm vụ là kết nối lại hoàn chỉnh các module này vào hệ thống Native Contrib, TUYỆT ĐỐI KHÔNG TỰ Ý XÓA HOẶC TẮT BẤT KỲ TÍNH NĂNG NÀO khi chưa có sự đồng ý của người dùng.
- **Quy trình thay đổi:** Nếu gặp vướng mắc kỹ thuật chưa rõ hướng xử lý, BẮT BUỘC phải dừng lại hỏi ý kiến người dùng (`/grill-me`), không tự ý suy diễn hoặc cắt bỏ tính năng.

---

## 12. Chuẩn Giao Diện Khung Chat Antigravity, Tích Hợp Cài Đặt Chuẩn & Tinh Gọn Thông Báo (Antigravity Chat Input, Native Settings Integration & Meaningful Messages)
- **Thiết kế Khung Nhập Lệnh Antigravity (Antigravity Input Card):**
  - Khung nhập lệnh mô phỏng chuẩn xác giao diện Google Antigravity IDE: bo góc mềm mại (`12px` - `14px`), viền mờ cao cấp, textarea tự co giãn với placeholder: `"Assign engineering objective to Multi-Agent Swarm... (@ to mention, / for actions)"`.
  - Hàng chức năng bên dưới khung nhập:
    - Bên trái: Icon nút thêm ngữ cảnh (`Codicon.add`), nhãn pill định danh Swarm/Model (`$(sparkle) Multi-Agent Swarm`).
    - Bên phải: Nút tròn biểu tượng mũi tên gửi lệnh (`Codicon.arrowUp`); tự động chuyển thành nút dừng đỏ (`Codicon.debugStop`) khi Swarm đang thực thi nhiệm vụ.
    - Tuyệt đối hạn chế dùng chữ khi đã có icon biểu đạt: loại bỏ các nút chữ thừa (`Dispatch Swarm`, `Stop`, `Ctrl+Enter to dispatch`).
- **Tinh Gọn Header & Tích Hợp Cài Đặt Mặc Định (Single Settings Button & Native Chat > Agent Settings):**
  - Cụm phím chức năng trên header khung chat chỉ giữ lại duy nhất **1 nút cài đặt** (`Codicon.settingsGear`).
  - Khi click nút cài đặt, mở trực tiếp trình cài đặt mặc định của VS Code tại phân mục `Chat > Agent` (`workbench.action.openSettings` với truy vấn `'chat.agent'`).
  - Toàn bộ tính năng cấu hình Multi-Agent (chọn model/CLI cho Architect, Worker, Auditor, bật/tắt Autopilot, liên kết chạy Doctor, CLI Login) được tích hợp trực tiếp vào schema cấu hình mặc định dưới tiền tố `chat.agent.*`, không viết giao diện ngoài rườm rà.
- **Loại Bỏ Hoàn Toàn Thông Báo Vô Nghĩa (Zero Meaningless Messages):**
  - Tuyệt đối cấm hiển thị các câu thông báo khởi tạo, chào hỏi rỗng tuếch hoặc vô nghĩa trong khung chat (như `MA Chat & Control View Initialized. Multi-Agent Orchestrator ready...`).
  - Khung chat phải khởi động hoàn toàn sạch sẽ (clean stream), chỉ hiển thị thông điệp thực tế của người dùng, tiến trình suy nghĩ (Thinking stream) thực tế từ Agent và báo cáo nghiệm thu cuối cùng của Auditor.

---

The operator explicitly authorized direct edits in this primary checkout.
Do not create extra worktrees unless the operator requests them. Preserve user changes and all other security boundaries.
