const { EmbedBuilder, ActionRowBuilder, ButtonBuilder } = require('discord.js');
const { getUserXP, addUserXP, getGuildSettings, getUserLevel } = require('../database.js');
const botColours = require('../botColours.json');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid'); // Assuming you're using uuid for generating error IDs

const cooldowns = new Map();

async function handleExperienceGain(message) {
  if (message.author.bot || !message.guild) {
    return;
  }

  const guildSettings = await getGuildSettings(message.guild.id);
  if (!guildSettings) {
    handleGuildSettingsError(message);
    return;
  }

  if (!guildSettings.modules.levels.enabled) {
    return;
  }

  // Check and apply cooldown
  const cooldownKey = `${message.guild.id}-${message.author.id}`;
  if (isOnCooldown(cooldownKey)) {
    return;
  }

  const oldLevel = await getUserLevel(message.guild.id, message.author.id); // Get the old level before XP gain

  const xpGain = getRandomXP(15,25); // Random XP between 10 and 30
  await addUserXP(message.guild.id, message.author.id, xpGain);

  const newLevel = await getUserLevel(message.guild.id, message.author.id); // Get the new level after XP gain

  if (newLevel > oldLevel) {
    message.reply(`Congratulations <@${message.author.id}>! You leveled up to level \`${newLevel}\`! 🎉`);
  }
}

function isOnCooldown(cooldownKey) {
  const now = Date.now();
  const cooldownDuration = 60 * 1000; // 60 seconds
  const lastMessageTimestamp = cooldowns.get(cooldownKey) || 0;

  if (now - lastMessageTimestamp < cooldownDuration) {
    return true;
  }

  cooldowns.set(cooldownKey, now);
  return false;
}

function getRandomXP(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}


function handleGuildSettingsError(message) {
  const errorId = uuidv4();
  const errorMessage = `Error ID: ${errorId}, Error Details: Guild settings not found for ${message.guild.id}`;
  console.error(errorMessage);
  fs.appendFile('errorLog.txt', errorMessage + '\n', err => {
    if (err) console.error('Error writing to error log:', err);
  });

  const errorEmbed = new EmbedBuilder()
    .setColor(botColours.red)
    .setTitle("Error")
    .setDescription(
      `The guild settings could not be found for ${message.guild.name} (\`${message.guild.id}\`).\nPlease contact support with the following error ID: \`${errorId}\`.`
    )
    .setTimestamp();

  const supportButton = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel("Support Server")
      .setStyle("Link")
      .setURL("https://discord.gg/BwD7MgVMuq")
  );

  message.channel.send({ embeds: [errorEmbed], components: [supportButton] });
}

module.exports = {
  handleExperienceGain,
};
