/**
 * X-Verify Platform — Time & Scoring Constants
 * ──────────────────────────────────────────────
 * ปรับค่าตรงนี้เพียงที่เดียวเพื่อเปลี่ยนพฤติกรรมทั้งระบบ
 */

// ── Post Cooldown ─────────────────────────────────────────────
/** ระยะเวลา cooldown ระหว่างการลงโพสแต่ละครั้ง (1 ชั่วโมง) */
export const POST_COOLDOWN_MS = 1 * 60 * 60 * 1000; // 3,600,000 ms

/** ข้อความแสดง cooldown ให้ผู้ใช้อ่าน */
export const POST_COOLDOWN_LABEL = '1 ชั่วโมง';

// ── Post Expiry ───────────────────────────────────────────────
/** อายุของโพสในฟีด — โพสเก่ากว่านี้จะถูกกรองออก (6 ชั่วโมง) */
export const POST_EXPIRY_MS = 6 * 60 * 60 * 1000; // 21,600,000 ms

/** ข้อความแสดงอายุโพสให้ผู้ใช้อ่าน */
export const POST_EXPIRY_LABEL = '6 ชั่วโมง';

// ── Interaction Scoring ───────────────────────────────────────
/** แต้มที่ได้รับต่อการช่วยเหลือ 1 โพส (กดปุ่มเดียว = 1 แต้ม) */
export const POINTS_PER_HELP = 1;

/**
 * คำนวณแต้มช่วยเหลือแบบไดนามิก (Dynamic Bounty) ตามอายุโพส
 * - < 2 ชม: +1 แต้ม
 * - 2 - 4 ชม: +2 แต้ม (ค้างนาน 🔥)
 * - 4 - 6 ชม: +3 แต้ม (ใกล้หมดอายุ 🚨)
 */
export function getPostHelpPoints(createdAt: number): number {
  const ageMs = Date.now() - createdAt;
  const oneHour = 60 * 60 * 1000;
  if (ageMs < 2 * oneHour) return 1;
  if (ageMs < 4 * oneHour) return 2;
  return 3;
}
