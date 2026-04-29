import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs/promises";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import cron from "node-cron";
import { initializeApp, cert, getApp, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

dotenv.config();

// Load Firebase Config for project details
const configPath = path.resolve(process.cwd(), "firebase-applet-config.json");
const firebaseConfig = JSON.parse(await fs.readFile(configPath, "utf-8"));

// Initialize Firebase Admin
// Note: In this environment, we might not have a service account file, 
// so we attempt to initialize with the project ID and rely on environment credentials if available.
if (!getApps().length) {
  initializeApp({
    projectId: firebaseConfig.projectId,
  });
}

const dbAdmin = firebaseConfig.firestoreDatabaseId 
  ? getFirestore(firebaseConfig.firestoreDatabaseId)
  : getFirestore();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  const sendEmail = async ({ to, subject, text, html }: { to: string, subject: string, text?: string, html?: string }) => {
    const user = process.env.GMAIL_USER;
    const pass = process.env.GMAIL_APP_PASSWORD;

    if (!user || !pass) {
      throw new Error("Configuração do Gmail ausente (GMAIL_USER ou GMAIL_APP_PASSWORD).");
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: user,
        pass: pass,
      },
    });

    const fromName = process.env.GMAIL_FROM_NAME || "Sistema de Inventário";
    const fromEmail = process.env.GMAIL_FROM || user;

    return await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: to,
      subject: subject,
      text: text,
      html: html,
    });
  };

  // Automated Inventory Task (Every Monday at 10:00 AM)
  cron.schedule("0 10 * * 1", async () => {
    console.log("[CRON] Checking for Monday 10h inventory notifications...");
    try {
      const settingsRef = dbAdmin.collection("settings").doc("config");
      const settingsSnap = await settingsRef.get();
      const settings = settingsSnap.exists ? settingsSnap.data() : {};
      
      const todayStr = new Date().toISOString().split('T')[0];
      
      if (settings?.lastAutoInventoryEmailSent === todayStr) {
        console.log("[CRON] Emails already sent for today.");
        return;
      }

      // 1. Fetch Materials to check for low stock
      const materialsSnap = await dbAdmin.collection("materials").get();
      const materials = materialsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const lowStockMaterials = materials.filter((m: any) => m.currentStock <= m.minStock);

      // 2. Fetch Users
      const usersSnap = await dbAdmin.collection("users").get();
      const allUsers = usersSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));

      let emailsSentCount = 0;

      // - Send to Purchasing Manager if low stock
      if (lowStockMaterials.length > 0 && settings?.purchasingManagerEmail) {
        const matListText = lowStockMaterials.map((m: any) => `- ${m.name}: ${m.currentStock} ${m.unit} (Mínimo: ${m.minStock})`).join("\n");
        await sendEmail({
          to: settings.purchasingManagerEmail,
          subject: "⚠️ LISTA DE COMPRAS: Materiais com estoque baixo",
          text: `Olá,\n\nIdentificamos que os seguintes itens estão com estoque baixo:\n\n${matListText}\n\nPor favor, providenciar a compra conforme a necessidade.\n\nAcesse o sistema: ${process.env.VITE_APP_URL || 'https://genomma-logistica.run.app'}`
        });
        emailsSentCount++;
      }

      // - Send to Inventory Responsibles
      const responsibles = allUsers.filter((u: any) => u.isInventoryResponsible && u.email);
      for (const resp of responsibles) {
        await sendEmail({
          to: resp.email as string,
          subject: "🕒 LEMBRETE: Inventário Semanal de Insumos - Segunda 10h",
          text: `Olá ${resp.displayName || ''},\n\nEste é um aviso automático para informar que está na hora de iniciar o Inventário Semanal de Insumos no CD de Extrema/MG.\n\nPor favor, realize a conferência dos estoques e atualize o sistema.\n\nAcesse o sistema: ${process.env.VITE_APP_URL || 'https://genomma-logistica.run.app'}`
        });
        emailsSentCount++;
      }

      // 3. Mark as sent
      await settingsRef.set({
        lastAutoInventoryEmailSent: todayStr
      }, { merge: true });

      console.log(`[CRON] Automatic inventory emails processed. Total sent: ${emailsSentCount}`);

    } catch (error) {
      console.error("[CRON] Error in inventory task:", error);
    }
  });

  // API Route for sending email manually (kept for flexibility)
  app.post("/api/send-email", async (req, res) => {
    try {
      const { to, subject, text, html } = req.body;
      const info = await sendEmail({ to, subject, text, html });
      console.log("Message sent: %s", info.messageId);
      res.json({ success: true, messageId: info.messageId });
    } catch (err: any) {
      console.error("Server error:", err);
      let errorMessage = err.message;
      if (errorMessage.includes("Invalid login")) {
        errorMessage = "Falha na autenticação do Gmail. Verifique se você está usando uma 'Senha de App'.";
      }
      res.status(500).json({ error: errorMessage });
    }
  });

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    
    // Serve index.html in dev mode
    app.get("*", async (req, res, next) => {
      const url = req.originalUrl;
      try {
        let template = await fs.readFile(path.resolve(process.cwd(), "index.html"), "utf-8");
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ "Content-Type": "text/html" }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
