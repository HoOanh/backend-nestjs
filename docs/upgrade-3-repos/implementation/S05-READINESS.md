# S05 — Gói chuẩn bị mở gate

03/11/2026 · Trạng thái: **chờ ĐẠI CA duyệt specs/stories** · Tài liệu này không chứa code hay migration S05.

Bám [S05 README](../phases/P03-classroom/sprints/S05-classroom-engine/README.md), [S05 specs](../phases/P03-classroom/sprints/S05-classroom-engine/specs.md), [SPEC-03](../specs/03-CLASSROOM-AI.md) và [WORKFLOW](../standards/WORKFLOW.md). Mục tiêu: chốt đủ Definition of Ready để mở S05 mà không phải sửa scope giữa sprint.

## 1. Snapshot tiến độ (đã kiểm 03/11/2026)

| Repo | HEAD | Trạng thái |
|---|---|---|
| arc-academy-backend | `17ba810` | clean, ngang `origin/main` |
| arc-academy-web | `3f2699b` | clean, ngang `origin/main` |
| arc-academy-cms | `34206c8` | clean, ngang `origin/main` |
| backend-nestjs (docs canonical) | `10cef9a` | `implementation/S04-REPORT.md` đang có thay đổi chưa commit (note follow-up 02/11) |

| Sprint | Gate | Ghi chú |
|---|---|---|
| S00 | locally qualified | baseline/rules/skills |
| S01 | locally qualified | 3 repo, auth/access/contracts |
| S02 | locally qualified | human acceptance **pending**, chưa có `signoff.json` |
| S03 | locally qualified | human acceptance **pending**; US-012 đã implemented local (canonical `implemented_local_verified`) dù `sprint-index.json` còn ghi `not_implemented` |
| S04 | **approved 30/10/2026** | sign-off 24/24 real stack; US-013/014/015 |
| S05 | draft | 16–24 PD, US-016/017/018, chưa mở |

Hiện trạng kỹ thuật liên quan trực tiếp S05:

- Backend đã có `LecturePackage`/`LecturePublication` (pin plan/visual/document + hash), assignment gate, audit, outbox, `IdempotencyRecord`. **Chưa có** Room/RoomVersion/ClassroomSession/SessionEvent/lease.
- Bảng `Session` hiện tại là phiên đăng nhập (auth), **không dùng lại** cho classroom; phải đặt tên `ClassroomSession`/`classroom_session`.
- Web đã có `NarrationClock`, `VisualRenderer`, route learner lecture và preview; `src/lib/classroom` + `src/lib/tts` mới chỉ có README, **chưa port engine/TTS/3D**, chưa có dependency `three`/`onnxruntime-web`.
- `next.config.ts` đã có COOP/COEP cho `/:locale/learn/:path*/classroom` → route classroom dự kiến khớp rule này.
- CMS đã có editor giáo án/visual/publish panel; chưa có room/persona/policy editor.

## 2. Definition of Ready — đối chiếu

| Điều kiện | Trạng thái | Việc cần làm |
|---|---|---|
| Dependency S04 đạt gate | ĐẠT | — |
| AC từng story rõ | ĐẠT (9 AC) | — |
| API/schema/state/permission contract được duyệt | **THIẾU** | Mục 4 dưới đây là bản đề nghị để duyệt |
| Fixture/reference lesson | MỘT PHẦN | Dùng lại course/lesson/package S04 + thêm 1 bài khác chủ đề |
| Negative/failure cases | MỘT PHẦN | SPEC-03 §5 có list; mục 6 map vào AC |
| Owner Backend/CMS/Web/reviewer/ops | **THIẾU** | Cần chỉ định người; 16–24 PD không vừa 1 người trong 2 tuần |
| Capacity | **THIẾU** | Đề nghị tách 3 slice (mục 3) |
| Human acceptance S02/S03 | **PENDING** | Quyết định: có bắt buộc đóng trước khi code S05 hay không (D-S05-01) |
| Production deploy/UAT hộp thư | **PENDING** | Railway + Brevo credential, `bootstrap:admin`, `prisma:deploy`; không chặn local S05 nhưng chặn pilot |

## 3. Đề nghị tách S05 thành 3 slice kiểm soát rủi ro

| Slice | Nội dung | Repo chính | Phụ thuộc | Ước lượng |
|---|---|---|---|---|
| **S05-A** | Room/RoomVersion + ClassroomSession + lease/event/checkpoint + CMS room editor + Web session client | Backend, CMS, Web | S04 | 8–11 PD |
| **S05-B** | Engine giảng/vẽ/focus/raise-hand + text fallback + cleanup/remount | Web (backend chỉ cấp snapshot) | S05-A | 6–9 PD |
| **S05-C** | TTS thật (browser ONNX hoặc server TTS) + 3D instructor + capability/degraded matrix | Web (+ backend nếu server TTS) | S05-B | 4–6 PD |

Lý do tách: S05-C là phần effort biến động nhất (bundle ONNX, COEP, Safari, WebGL) và có thể phát hành sau cờ `capability`; S05-A/B mới là xương sống AC-016/017/018. Nếu ĐẠI CA muốn giữ 1 sprint, vẫn nên giữ thứ tự A → B → C và coi C là "best effort, có fallback text" thay vì điều kiện đóng sprint.

## 4. Contract đề nghị duyệt (chưa code)

### 4.1 Dữ liệu

**Room** (logical template, không chứa snapshot bài giảng)

| Field | Kiểu | Ràng buộc |
|---|---|---|
| id | uuid | PK |
| lessonId | uuid | FK Lesson; unique 1 room/lesson ở R1 |
| title | string | 3–120 |
| ownerId | uuid | FK Account |
| state | enum | `draft \| published \| archived` |
| currentVersion | int? | version đang publish |
| version | int | optimistic lock cho draft/PATCH |
| createdAt/updatedAt | datetime | — |

**RoomVersion** (immutable sau publish)

| Field | Kiểu | Ràng buộc |
|---|---|---|
| id | uuid | PK |
| roomId | uuid | FK Room |
| version | int | unique(roomId, version), tăng đơn điệu |
| packageId | uuid | FK LecturePackage, **bắt buộc state=published** |
| packageHash | string | copy từ package, chống drift |
| persona | json | `{id, displayName, locale, tone, systemPromptVersion}`; prompt thật không trả public |
| voicePolicy | json | `{mode: "browser_tts"\|"server_tts"\|"text", locale, voiceId?}` |
| checkpointPolicy | json | `{requiredCheckpointIds: uuid[], requireServerGrade: true, allowRetry: bool}` |
| publishedBy/publishedAt | uuid/datetime | reviewer hoặc người có quyền publish |
| createdAt | datetime | — |

**ClassroomSession** (bảng `classroom_session`)

| Field | Kiểu | Ràng buộc |
|---|---|---|
| id | uuid | PK |
| accountId | uuid | FK Account, owner |
| roomId/roomVersionId | uuid | pin tại thời điểm tạo |
| snapshot | json | bản sao package/persona/policy đã pin; session cũ không đổi khi publish version mới |
| status | enum | `created \| preparing \| active \| paused \| completed \| aborted \| expired` |
| serverVersion | int | CAS cho mọi mutation |
| leaseId | string? | hash/id lease hiện hành |
| leaseExpiresAt | datetime? | TTL 60s, heartbeat 20s |
| lastAckSequence | int | mặc định 0 |
| resumeCheckpointId/resumeBeatId | string? | resume |
| clientRequestId | string | unique(accountId, clientRequestId) chống tạo trùng |
| quotaReservationId | string? | để trống ở S05, chốt ở D-S05-07 |
| startedAt/endedAt | datetime? | — |

**SessionEvent** (append-only)

| Field | Kiểu | Ràng buộc |
|---|---|---|
| id | uuid | PK |
| sessionId | uuid | FK |
| eventId | string | unique(sessionId, eventId), client sinh |
| sequence | int | unique(sessionId, sequence), tăng dần |
| leaseId | string | phải khớp lease hiện hành |
| kind | enum | `tick \| checkpoint_ack \| raise_hand \| resume \| pause \| finish` |
| checkpointId/beatId | string? | phải thuộc snapshot |
| position | json | `{beatId?, elapsedMs}`; tick 5–10s |
| createdAt | datetime | server time |

**SessionCheckpointAttempt** (private)

| Field | Kiểu | Ràng buộc |
|---|---|---|
| id | uuid | PK |
| sessionId + checkpointId + attemptNo | — | unique |
| answer | json | **không** trả lại qua public read model |
| serverResult | json | `{passed: boolean, score?, feedback?}`, server chấm |
| createdAt | datetime | — |

### 4.2 Endpoint

Staff `i/v1` (permission + ownership):

- `POST /i/v1/rooms` `{lessonId,title}` → draft room.
- `GET /i/v1/rooms?lessonId=` · `GET /i/v1/rooms/{id}`.
- `PATCH /i/v1/rooms/{id}` If-Match `version` → chỉ metadata draft.
- `POST /i/v1/rooms/{id}/versions` `{packageId,persona,voicePolicy,checkpointPolicy,expectedVersion}` → draft version; từ chối package chưa publish kèm `details: {packageState, missing[]}`.
- `POST /i/v1/rooms/{id}/versions/{version}/publish` If-Match room version → atomic set `currentVersion` + `state=published` + audit + outbox `classroom.room.published`.
- `GET /i/v1/rooms/{id}/versions`.

Learner `p/v1` (auth + assignment active; không leak tồn tại):

- `POST /p/v1/classroom/sessions` `{roomId, clientRequestId}` → `{sessionId, snapshotEndpoints, serverTime, lease, serverVersion, resume}`.
- `GET /p/v1/classroom/sessions/{id}` → self only; trả snapshot/lastAck/resume, **không** answerKey/private source.
- `POST /p/v1/classroom/sessions/{id}/lease` `{action:"acquire"|"renew"|"takeover", expectedVersion, leaseId?}` → CAS; takeover ghi audit.
- `POST /p/v1/classroom/sessions/{id}/events` `{eventId,sequence,leaseId,expectedVersion,kind,checkpointId?,beatId?,position}` → ack `{lastAckSequence, serverVersion}`; duplicate trả ack cũ; out-of-order trả snapshot hiện hành, không ghi.
- `POST /p/v1/classroom/sessions/{id}/checkpoints/{checkpointId}/attempts` `{answer}` → server grade; client không gửi `passed`.
- `POST /p/v1/classroom/sessions/{id}/pause` · `/finish` `{expectedVersion}` + `Idempotency-Key`.
- `POST /p/v1/classroom/sessions/{id}/abort` (self) — đóng phiên khi lỗi chuẩn bị/rời phòng.

### 4.3 Permission key đề nghị

| Key | Actor | Dùng cho |
|---|---|---|
| `classroom:room:read` | content_editor, content_reviewer, admin | đọc room/version |
| `classroom:room:write` | content_editor, admin | tạo/sửa draft version |
| `classroom:room:publish` | content_reviewer, admin | publish version (D-S05-02) |
| `classroom:session:read` | student (self), mentor (scope riêng), admin | đọc session; ownership/assignment enforce ở service |
| `classroom:session:mentor` | mentor, admin | read model mentor; có thể hoãn S09 (D-S05-06) |

Không cấp quyền ghi session qua permission tĩnh: writer hợp lệ = owner + lease hiện hành + assignment active. Revoke assignment có hiệu lực ngay ở lần request kế tiếp (kiểm tra DB, không cache).

### 4.4 State machine và invariant

```
created → preparing → active ⇄ paused → completed
active|paused|preparing → aborted
active|paused → expired (server sweep)
```

- Chỉ server đổi trạng thái; client gửi `expectedVersion`, sai → `409 version_conflict` kèm `serverVersion`.
- `completed` chỉ khi `checkpointPolicy.requiredCheckpointIds` đều có attempt `serverResult.passed=true` (hoặc policy cho phép retry đã cạn). Không chấp nhận `completed` do client gửi.
- `finish` idempotent theo `Idempotency-Key`; lặp lại trả cùng kết quả.
- Publish room version mới **không** đổi `snapshot` của session đang chạy (AC-016-03).
- Session tạo từ room `draft`/version chưa publish → `409 room_not_published`.
- Snapshot public không chứa `answerKey`, `explanation`, `document.text`, system prompt, provider secret.

### 4.5 Lease / single writer / idempotency

- Lease TTL 60s; client renew mỗi 20s; hết hạn coi như mất quyền ghi.
- `takeover` yêu cầu `expectedVersion`; writer cũ nhận `409 stale_lease` ở event/finish kế tiếp.
- Event: `unique(sessionId,eventId)`; trùng → trả `ack` cũ, không ghi; `sequence` lệch → trả `{lastAckSequence, snapshot}`.
- Pending offline chỉ nằm client; UI chỉ báo "đã lưu" sau ack `serverVersion`.
- Mọi mutation ghi `AuditLog` (publish, takeover, finish, checkpoint attempt) với actor thật.

### 4.6 Client capabilities / fallback

`snapshot.capabilities` do server trả theo policy, client tự dò thêm:

| Capability | Thiếu thì |
|---|---|
| WebAudio/TTS | chuyển `voicePolicy.mode=text` + captions; bài giảng vẫn chạy |
| WebGPU/WebGL (3D) | ảnh tĩnh instructor + narration; không chặn tài liệu |
| Worker/ONNX | text chat; ẩn nút voice |
| STT | chỉ text chat (S06 mới có chat AI; S05 raise-hand vẫn dùng nút) |

## 5. Fixture và demo đề nghị

- Dùng lại course `1dfbef33-80f0-4011-a800-dd3f51ebc4b3` / lesson `29c8813e-0901-4610-b5de-3e17a94b047f` / package `139e2d3d-6069-4b15-89e9-8d2c9b119533` từ sign-off S04 (đã có assignment + visual + beat).
- Thêm 1 lesson khác chủ đề có package publish riêng để tránh overfit schema room/session.
- Account: `student.s05@arc.local` (assignment active), `outsider.s05@arc.local` (không assignment), `editor.s05@arc.local`, `reviewer.s05@arc.local`; chỉ dùng script guarded local, không commit credential.
- Demo đóng sprint (đúng exit gate):
  1. Editor tạo room từ package, bind persona/voice/checkpoint, reviewer publish v1.
  2. Student được gán vào room, engine chạy narration + focus/ink, giơ tay → pause → resume đúng beat.
  3. Checkpoint server chấm; tắt TTS/3D → fallback text vẫn học tiếp.
  4. Mở tab thứ hai: resume đúng `snapshot/lastAck/checkpoint`; takeover lease → tab cũ 409.
  5. Publish v2 giữa phiên → phiên cũ vẫn dùng snapshot v1.

## 6. Ma trận evidence theo AC

| AC | Layer | Evidence tối thiểu |
|---|---|---|
| AC-016-01 | Backend e2e + CMS browser + Web browser | HTTP/Postgres thật: publish version pin đúng package/persona/policy; student assignment active tạo session được |
| AC-016-02 | Backend e2e negative | Bind plan/source/package draft → 409 kèm reference cụ thể; UI hiển thị lỗi, không tạo version |
| AC-016-03 | Backend e2e + 2 tab browser | Publish v2 trong lúc session active; `GET session` và UI vẫn snapshot v1 |
| AC-017-01 | Web Playwright real browser | Vào phòng → play → raise-hand → pause tại beat X → resume tiếp beat X; DOM `data-beat-state` đúng |
| AC-017-02 | Web browser matrix + unit | Block TTS/ONNX/WebGL → text/captions fallback; tài liệu vẫn đọc được; ghi rõ browser đã/chưa chạy |
| AC-017-03 | Web Playwright + instrumentation | Rời route/remount: 0 RAF/audio/worker/WebGL còn sống, lecture không chạy 2 lần; dùng counter trong test |
| AC-018-01 | Backend e2e + 2 device/tab | Ack checkpoint ở device A → mở device B → resume đúng checkpoint/lastAck/beat |
| AC-018-02 | Backend e2e negative | 2 writer + takeover; stale 409; client gửi `completed/passed` giả bị bỏ qua; mastery chỉ từ server grade |
| AC-018-03 | Backend e2e + Web offline test | Trùng `eventId` dedup, retry sau mất mạng không nhân đôi; pending không hiện "đã lưu" trước ack |

Bổ sung bắt buộc ngoài AC (SPEC-03 §5): unauthorized cross-account session, revoke assignment giữa phiên, publish mid-session, provider/TTS timeout (nếu S05-C), prompt injection **để S06**.

## 7. Thứ tự thực hiện đề nghị

1. **Chốt D-S05-01..08** (mục 8) + duyệt contract mục 4.
2. Backend: migration + Room/RoomVersion + publish + audit/outbox; e2e AC-016.
3. Backend: ClassroomSession + lease/event/checkpoint/finish; e2e AC-018.
4. OpenAPI + regenerate client CMS/Web; Bruno collection.
5. CMS: room editor + version list + publish + preview link; browser test.
6. Web: route `/learn/.../classroom`, session client + resume + lease; Playwright AC-016/018.
7. Web: engine narration/ink/focus/raise-hand + cleanup; Playwright AC-017-01/03.
8. S05-C: TTS/3D theo quyết định D-S05-03/04; fallback matrix AC-017-02.
9. Real-stack sign-off + `SIGNOFF.md`/`signoff.json` như S04.

Gate chất lượng mỗi bước: `pnpm quality:check` cả 3 repo, contract drift, migration reversible, không `any`, không credential trong fixture/log.

## 8. Quyết định cần ĐẠI CA chốt

| ID | Quyết định | Đề nghị của em |
|---|---|---|
| D-S05-01 | Mở S05 ngay hay đóng human acceptance S02/S03 trước? | Đóng S02/S03 song song trong lúc làm S05-A; không chặn code local, nhưng phải xong trước pilot R1 |
| D-S05-02 | Creator có được tự publish room version? | Không. Dùng `classroom:room:publish` + reviewer độc lập như lecture package |
| D-S05-03 | 3D instructor trong R1? | Làm sau cờ capability, fallback ảnh tĩnh + narration; không là điều kiện đóng S05 |
| D-S05-04 | TTS R1: browser ONNX, server TTS hay text-first? | Browser ONNX (port zeroTTS) + server TTS sau; text-first luôn có |
| D-S05-05 | Checkpoint policy R1 | 1 policy cố định: required checkpoint + server grade + retry tối đa 3 |
| D-S05-06 | Mentor read session | Hoãn S09; S05 chỉ self |
| D-S05-07 | Quota reservation | Hoãn S06 (SPEC-03 §3); S05 chỉ chặn theo assignment/room state |
| D-S05-08 | Browser evidence tối thiểu | Chrome desktop + Safari iOS simulator; Firefox/Android ghi `not_executed` nếu không có thiết bị |

## 9. Drift/debt phát hiện trong lần kiểm này

1. `sprint-index.json` S03 còn `not_implemented: ["US-012"]` và `authorized_scope` chỉ US-010/011, trong khi canonical `user-stories.json` đã `implemented_local_verified` và S03-REPORT có mục US-012. Cần sync.
2. `ROADMAP.md` dòng cuối còn "S03 trở đi chưa implementation" — sai thực tế từ 29/10.
3. S02/S03 chưa có `SIGNOFF.md`/`signoff.json` dù status `locally_qualified`.
4. `implementation/S04-REPORT.md` đang dirty trong docs repo (note follow-up 02/11 chưa commit).
5. Web `src/lib/tts`/`src/lib/classroom` chỉ có README; chưa có dependency `three`/`onnxruntime-web` → effort S05-C chưa được phản ánh trong code.
6. S04 còn nợ ngoài phạm vi: TTS/audio thật, preview external frame; learner browser test mặc định dùng fixture API (sign-off S04 đã chạy stack thật).
7. Production ops chưa chạy: Railway + Brevo credential, `bootstrap:admin`, `prisma:deploy`; không chặn S05 local nhưng chặn pilot.

## 10. Việc em đề nghị được làm ngay sau khi ĐẠI CA duyệt

1. Sync drift mục 9.1–9.4 (chỉ sửa trạng thái/tài liệu, không đổi scope).
2. Tạo migration + module `classroom/rooms` và `classroom/sessions` theo contract mục 4, bắt đầu bằng e2e AC-016/018 (backend trước, CMS/Web sau).
3. Tạo acceptance folder `acceptance/2026-11-XX-S05-...` với fixture/script guarded, không commit credential.
4. Chốt owner/capacity cho 3 slice trước khi bắt đầu S05-B.
