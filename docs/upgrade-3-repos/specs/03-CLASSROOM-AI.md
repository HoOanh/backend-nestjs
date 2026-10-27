# SPEC-03 — Lớp AI 1-1, hội thoại và tiến trình

DRAFT 0.2 · S05/S06/S08/S09.

## 1. Room/session

Room logical template; RoomVersion immutable packageId/personaVersion/voicePolicy/checkpointPolicy. Session accountId/roomVersionId/status/serverVersion/writerLease/lastAckSequence/resumeCheckpointId/beatId/quotaReservation/startedAt/endedAt. Status created→preparing→active↔paused→completed; active/paused→aborted/expired; preparation failure retry/abort. Completed chỉ khi required checkpoint evidence đúng policy; AI summary async không chặn completion.

POST I/rooms và versions/publish dùng content/room permission; POST P/classroom/sessions(roomId,optional occurrenceId,clientRequestId)→pinned package/serverTime/lease/version/resume. GET session self hoặc mentor scope riêng. POST lease(acquire/renew/takeover,expectedVersion) atomic CAS; POST events(eventId,sequence,leaseId,expectedVersion,checkpoint/beat,kind,position) validate whitelist; POST checkpoints/{id}/attempts(answer) server grade; POST pause/finish expectedVersion + Idempotency-Key.

Client không gửi trusted quiz_passed/completedScore. Dedupe session+eventId; stale writer/version409, duplicate event trả ack cũ; out-of-order trả snapshot/lastAck. Pending offline events không được UI báo saved. Checkpoint ack là durable; position tick5–10s đề xuất, mất tick có thể replay beat nhưng không mất checkpoint ack. Switch account xoá pending/private cache. New publish không đổi active snapshot.

## 2. Conversation grounded theo bài

POST P/classroom/sessions/{id}/messages(clientMessageId,text,checkpointId,attachmentRef optional) fetch-SSE; source context gắn pinned objective/slide/checkpoint + permitted document spans + bounded history. Image attachment chỉ khi provider/policy supports và đã finalize, không tự mở mọi upload. Actor owner và source access enforce trước provider call.

Frames accepted(runId), delta(sequence,text), citation(refs), completed(messageId), failed(code,retryable). Không URL token. Cancel signal propagate, usage settle; reconnect query GET runs/{id} + persisted message, không gọi provider lần hai mù. Source ref validator trước expose; không có bằng chứng → giải thích giới hạn thay fabricated citation. Speech text/captions nhất quán; STT unsupported chuyển text chat. Prompt active version pin mỗi run; provider secret không về browser.

Raise-hand: pause lecture→capture question→respond/explain→offer check-understanding→resume original beat hoặc chọn reviewed alternate explanation. S08 mở adaptive explanation từ approved objectives/source/visual schema, không tự sửa published plan. Model không tự đánh checkpoint pass từ lời nhận xét chung.

## 3. Progress/summary/insights

CheckpointAttempt private answer+serverResult, unique attempt ID; LessonProgress unique enrollment+lesson với provenance. Playback progress tách mastery. Transcript text lưu theo retention/consent, không mic raw mặc định. Summary có inputHash/promptVersion/confusionPoints/followUps/citation và trạng thái pending/ready/failed. Insights aggregate câu hỏi/drop-off theo objective, không bịa learning outcome từ thời gian xem. Mentor read transcript cần permission riêng+assignment+audit.

Quota reserve atomic per-user/task + global budget trước AI/session; timeout chưa rõ charge đánh unknown/reconcile. Core đọc tài liệu vẫn được khi AI unavailable, UI báo degraded. Module drain chặn new session/job, phiên đang chạy tối đa15m đề xuất; suspended account/emergency disable chặn ngay.

## 4. Cohort S09

Class course/mentor/status; Roster effective dates; Occurrence scheduleVersion/startUTC/endUTC/IANA timezone; primary session unique occurrence+student. CMS tạo room/class/roster/schedule, mentor xem assigned progress; mỗi học viên có session riêng không shared AV. Reschedule/cancel không sửa lịch sử phiên; reminders in-app là tối thiểu, email integration chưa bắt buộc nếu không duyệt. External multi-user video không thuộc scope.

## 5. Test cases

Disconnect trước/sau ack;2writers/takeover; fake complete/foreign checkpoint; publish mid-session; STT/TTS/WebGPU unsupported; prompt injection từ document; unauthorized source/cross-account session; cancel/provider timeout; concurrent quota; wrong citation; summary fail; assignment revoke; timezone/reschedule/dedup occurrence.
