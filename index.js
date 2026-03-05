const { TelegramClient, Api } = require("telegram");
const { StringSession } = require("telegram/sessions");
const { NewMessage } = require("telegram/events");
const input = require("input");
const dotenv = require("dotenv");

dotenv.config();

const APP_ID = Number(process.env.APP_ID);
const APP_HASH = process.env.APP_HASH;
const MY_PERSONAL_GROUP_ID = process.env.MY_GROUP;
const TARGET_GROUP_IDS = process.env.TARGET_GROUP_IDS
  ? process.env.TARGET_GROUP_IDS.split(",").map((id) => id.trim())
  : [];


  const keywords = process.env.KEYWORDS_TO_USE
  ? process.env.KEYWORDS_TO_USE.split(",").map((id) => id.trim())
  : [];

console.log("🎯 Monitoring these IDs:", TARGET_GROUP_IDS);

const stringSession = new StringSession(process.env.SESSION_STRING || "");

(async () => {
  const client = new TelegramClient(stringSession, APP_ID, APP_HASH, {
    connectionRetries: 5,
  });

  await client.start({
    phoneNumber: async () => await input.text("Number (+234...): "),
    password: async () => await input.text("2FA Password: "),
    phoneCode: async () => await input.text("Code from Telegram: "),
  });
  console.log("YOUR SESSION STRING:", client.session.save());
  console.log("✅ Logged in successfully!");
  console.log("👂 Listening for messages...");

  client.addEventHandler(async (event) => {
    const message = event.message;
    if (!message || !message.message) return;
    const chatId =
      message.peerId?.chatId?.toString() ||
      message.peerId?.channelId?.toString() ||
      message.chatId?.toString();

    const chat = await message.getChat();
    const groupName = chat?.title || "Private Chat";

    console.log(`📩 New message in [${groupName}] (ID: ${chatId})`);

    const isTargetGroup = TARGET_GROUP_IDS.includes(chatId);

    if (isTargetGroup) {
      const lowerText = message.message.toLowerCase();
      const wordsInMessage = lowerText.split(/\W+/);
      const containsKeyword = keywords.some((word) =>
        wordsInMessage.includes(word.toLowerCase()),
      );

      if (containsKeyword) {
        try {
          const sender = await message.getSender();
          if (sender) {
            try { await client.getEntity(sender.id); } catch (e) { /* silent catch */ }
          }


          const fullName = `${sender?.firstName || "Unknown"} ${sender?.lastName || ""}`.trim();
          const username = sender?.username ? `@${sender.username}` : "No Username";
          const phoneNumber = sender?.phone ? `+${sender.phone}` : "Number Hidden 🔒";
          const contactLink = sender?.username 
            ? `https://t.me/${sender.username}` 
            : `tg://user?id=${sender?.id}`;

          const customMessage = `📢 **SOURCE:** ${groupName}
━━━━━━━━━━━━━━━━━━
👤 **Name:** ${fullName}
📞 **Phone:** ${phoneNumber}
🆔 **User:** ${username}
💬 **Request:**
"${message.message}"
━━━━━━━━━━━━━━━━━━
🚀 [CLICK HERE TO REPLY](${contactLink})`;

          await client.sendMessage(MY_PERSONAL_GROUP_ID.toString(), {
            message: customMessage,
            parseMode: "markdown",
            linkPreview: false,
          });

          console.log(`✅ Success: Lead from ${groupName} sent!`);
        } catch (err) {
          console.error("❌ Send Error:", err.message);
        }
      } else {
        console.log("⏭️ Message skipped (No keywords found).");
      }
    }
  }, new NewMessage({}));

  await new Promise(() => {});
})();
