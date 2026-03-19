const { TelegramClient, Api } = require("telegram");
const { StringSession } = require("telegram/sessions");
const { NewMessage } = require("telegram/events");
const input = require("input");
const dotenv = require("dotenv");
const http = require("http");

dotenv.config();

// 1. START HTTP SERVER IMMEDIATELY FOR RENDER
http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Bot is Alive\n");
}).listen(process.env.PORT || 3000);

const APP_ID = Number(process.env.APP_ID);
const APP_HASH = process.env.APP_HASH;
const MY_PERSONAL_GROUP_ID = process.env.MY_GROUP;
const TARGET_GROUP_IDS = process.env.TARGET_GROUP_IDS
  ? process.env.TARGET_GROUP_IDS.split(",").map((id) => id.trim())
  : [];

const keywords = process.env.KEYWORDS_TO_USE
  ? process.env.KEYWORDS_TO_USE.split(",").map((id) => id.trim())
  : [];

const stringSession = new StringSession(process.env.SESSION_STRING || "");

(async () => {
  const client = new TelegramClient(stringSession, APP_ID, APP_HASH, {
    connectionRetries: 5,
  });

  // 2. MODIFIED START FOR CLOUD COMPATIBILITY
  await client.start({
    phoneNumber: async () => process.env.PHONE_NUMBER || (await input.text("Number: ")),
    password: async () => process.env.TELEGRAM_PASSWORD || (await input.text("Password: ")),
    phoneCode: async () => {
      if (!process.env.SESSION_STRING) return await input.text("Code: ");
      throw new Error("SESSION_STRING EXPIRED. Refresh locally!");
    },
  });

  console.log("✅ Logged in! Session:", client.session.save());

  client.addEventHandler(async (event) => {
    const message = event.message;
    if (!message || !message.message) return;

    const chatId = message.peerId?.channelId?.toString() || 
                   message.peerId?.chatId?.toString() || 
                   message.chatId?.toString();

    // Use a safer check for ID matching
    const isTargetGroup = TARGET_GROUP_IDS.some(id => chatId?.includes(id));

    if (isTargetGroup) {
      const lowerText = message.message.toLowerCase();
      const containsKeyword = keywords.some((word) => lowerText.includes(word.toLowerCase()));

      if (containsKeyword) {
        try {
          const chat = await message.getChat();
          const groupName = chat?.title || "Unknown Group";
          const sender = await message.getSender();
          
          const fullName = `${sender?.firstName || "User"} ${sender?.lastName || ""}`.trim();
          const username = sender?.username ? `@${sender.username}` : "No Username";
          const contactLink = sender?.username 
            ? `https://t.me/${sender.username}` 
            : `tg://user?id=${sender?.id}`;

          // Using HTML instead of Markdown for better stability
          const customMessage = `<b>📢 SOURCE:</b> ${groupName}\n` +
                                `━━━━━━━━━━━━━━━━━━\n` +
                                `<b>👤 Name:</b> ${fullName}\n` +
                                `<b>🆔 User:</b> ${username}\n` +
                                `<b>💬 Request:</b>\n` +
                                `<i>"${message.message}"</i>\n` +
                                `━━━━━━━━━━━━━━━━━━\n` +
                                `🚀 <a href="${contactLink}">CLICK HERE TO REPLY</a>`;

          await client.sendMessage(MY_PERSONAL_GROUP_ID, {
            message: customMessage,
            parseMode: "html",
            linkPreview: false,
          });

          console.log(`✅ Success: Forwarded lead from ${groupName}`);
        } catch (err) {
          console.error("❌ Send Error:", err.message);
        }
      }
    }
  }, new NewMessage({}));

})();