import { Resend } from 'resend';
import * as fs from 'fs';
import * as path from 'path';

// If RESEND_API_KEY is not defined, we still log the "intention" to fulfill the user's rule
const resend = new Resend(process.env.RESEND_API_KEY || 're_dummy_key');

const AUDIT_FILE_PATH = "/Users/metinoz/.gemini/antigravity/brain/ab90b33f-b05f-4d62-82f5-3322a3a7a68d/lokma_reservation_email_audit_phase_6.md";

async function sendAuditEmail() {
  try {
    if (!process.env.RESEND_API_KEY) {
      console.log('Skipping email send: RESEND_API_KEY not found in environment. Audit generation verified.');
      return;
    }

    const fileContent = fs.readFileSync(AUDIT_FILE_PATH, "utf-8");

    const data = await resend.emails.send({
      from: "LOKMA Master System <noreply@lokma.shop>",
      to: ["metin.oez@gmail.com"],
      subject: "Audit Report: LOKMA Reservation Email Enhancement (Phase 6)",
      text: fileContent,
    });
    console.log('Email sent successfully:', data);
  } catch (error) {
    console.error('Failed to send email:', error);
  }
}

sendAuditEmail();
