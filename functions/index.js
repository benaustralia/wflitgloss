const { onSchedule } = require("firebase-functions/v2/scheduler");
const { getFirestore } = require("firebase-admin/firestore");
const { getStorage } = require("firebase-admin/storage");
const { initializeApp } = require("firebase-admin/app");
const { defineSecret } = require("firebase-functions/params");
const nodemailer = require("nodemailer");

initializeApp();

const gmailAddress = defineSecret("GMAIL_ADDRESS");
const gmailAppPassword = defineSecret("GMAIL_APP_PASSWORD");
const backupRecipient = defineSecret("BACKUP_RECIPIENT");

exports.dailyBackup = onSchedule(
  {
    schedule: "every day 02:00",
    timeZone: "Australia/Melbourne",
    region: "australia-southeast1",
  },
  async () => {
    const db = getFirestore();
    const bucket = getStorage().bucket();

    // Export all terms as JSON
    const snap = await db.collection("terms").get();
    const terms = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const json = JSON.stringify(terms, null, 2);

    // Write today's backup
    const today = new Date().toISOString().slice(0, 10);
    const fileName = `backups/terms-${today}.json`;
    await bucket.file(fileName).save(json, {
      contentType: "application/json",
    });
    console.log(`Backup saved: ${fileName} (${terms.length} terms)`);

    // Delete backups older than 30 days
    const [files] = await bucket.getFiles({ prefix: "backups/terms-" });
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    let deleted = 0;
    for (const file of files) {
      const dateStr = file.name.match(/terms-(\d{4}-\d{2}-\d{2})/)?.[1];
      if (dateStr && new Date(dateStr).getTime() < cutoff) {
        await file.delete();
        deleted++;
      }
    }
    if (deleted > 0) {
      console.log(`Cleaned up ${deleted} old backup(s)`);
    }
  }
);

exports.weeklyBackupEmail = onSchedule(
  {
    schedule: "every monday 08:00",
    timeZone: "Australia/Melbourne",
    region: "australia-southeast1",
    secrets: [gmailAddress, gmailAppPassword, backupRecipient],
  },
  async () => {
    const bucket = getStorage().bucket();

    // Find today's backup (dailyBackup runs at 02:00, this runs at 08:00)
    const today = new Date().toISOString().slice(0, 10);
    const fileName = `backups/terms-${today}.json`;
    const file = bucket.file(fileName);

    const [exists] = await file.exists();
    if (!exists) {
      console.log(`No backup found for ${today}, skipping email`);
      return;
    }

    const [contents] = await file.download();
    const terms = JSON.parse(contents.toString());

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: gmailAddress.value(),
        pass: gmailAppPassword.value(),
      },
    });

    await transporter.sendMail({
      from: gmailAddress.value(),
      to: backupRecipient.value(),
      subject: `Litgloss Weekly Backup - ${today} (${terms.length} terms)`,
      text: `Attached is your weekly litgloss backup from ${today} containing ${terms.length} terms.`,
      attachments: [
        {
          filename: `litgloss-backup-${today}.json`,
          content: contents,
          contentType: "application/json",
        },
      ],
    });

    console.log(`Weekly backup email sent to ${backupRecipient.value()}`);
  }
);
