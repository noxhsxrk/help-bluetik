# ติ๊กฟ้าช่วยติ๊กฟ้า - X Engagement Exchange Platform

แพลตฟอร์มประสานงานค่าน้ำใจและแลกเปลี่ยน Impressions สำหรับกลุ่มครีเอเตอร์พรีเมียมที่มีเครื่องหมายยืนยันสิทธิ์ (X Verify) ประเทศไทย

---

## 🚀 สแตกเทคโนโลยี (Tech Stack)

- **Frontend**: Next.js 16.2.6 (App Router) + Tailwind CSS v4 + TypeScript
- **State & Database**: Pluggable Memory Adapter (จัดเตรียมโครงสร้างเตรียมเปลี่ยนเป็น Supabase / PostgreSQL)
- **Package Manager**: pnpm

---

## 🛠️ วิธีการติดตั้งและรันโครงการ (Getting Started)

โครงการนี้ใช้ `pnpm` (เวอร์ชัน 9) เป็นระบบจัดการไลบรารีและอ้างอิงเวอร์ชัน Node.js v20.19.0.

### 1. ติดตั้งไลบรารีทั้งหมด (Dependencies Installation)
```bash
npx pnpm@9 install
```

### 2. รันระบบสำหรับการพัฒนา (Run Local Server)
```bash
npx pnpm@9 dev
```
เปิดเบราว์เซอร์แล้วไปที่ [http://localhost:3000](http://localhost:3000)

### 3. รันการคอมไพล์เพื่อทดสอบความสมบูรณ์ (Build Checks)
```bash
npx pnpm@9 build
```

---

## 📂 โครงสร้างโฟลเดอร์หลัก (Project Structure)

```text
/src
├── app/
│   ├── api/
│   │   ├── admin/
│   │   │   ├── cooldowns/  - API เคลียร์ล็อกเวลาลงโพส
│   │   │   └── users/      - API พิจารณาการอนุมัติสิทธิ์แรกเข้า
│   │   ├── auth/
│   │   │   ├── session/    - ตรวจสอบคุกกี้เซสชัน
│   │   │   └── x-sso/      - จำลองการยืนยันตัวตน SSO
│   │   ├── interactions/   - บันทึกไลค์/รีโพส และคำนวณคะแนนช่วยเหลือ
│   │   ├── posts/          - ตัวจัดการฟีด ตรวจสอบเวลา 12h และคูลดาวน์ 1h
│   │   └── trends/         - ติดตามกระแสแฮชแท็กในไทย
│   ├── globals.css         - นำเข้าฟอนต์และกำหนดคีย์ธีม Tailwind v4 (@theme)
│   ├── layout.tsx          - โครงสร้างและ Metadata ภาษาไทย
│   └── page.tsx            - หน้าหลักและตัวคุม UI คอนโซลทั้งหมด
├── lib/
│   └── db.ts               - ตัวเชื่อมต่อข้อมูลและ API ปลั๊กอินภายในบอร์ด
```

---

## 🛡️ นโยบายการสลับสิทธิ์และความปลอดภัย (Admin Console Simulator)

สำหรับการทดสอบระบบบนเครื่อง Local:
1. ลงชื่อเข้าใช้งานด้วยชื่อบัญชีที่คุณต้องการ (เช่น `@NongVerify`).
2. หากเป็นบัญชีใหม่จะขึ้นหน้าจอรอดำเนินการ (Pending).
3. เลื่อนลงไปด้านล่างสุดของหน้าเว็บบริเวณ Footer.
4. กดที่ลิงก์ลับ **"เปิดระบบควบคุมแอดมินหลังบ้าน (Admin Console Toggle)"** เพื่อยกระดับสิทธิ์ให้กับบัญชีจำลองของคุณ และจะปรากฏเมนู **Admin Panel** ในแถบนำทางหลักทันทีเพื่ออนุมัติสิทธิ์ผู้ใช้งานใหม่.
# help-bluetik
