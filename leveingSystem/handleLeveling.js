const cooldowns = new Map();
const { getUserXP, addUserXP, getGuildSettings, getUserLevel, getLevelXPRequirement } = require('../database.js');
const { EmbedBuilder } = require('discord.js');
const botColours = require('../botColours.json');

async function handleExperienceGain(message) {
  if (message.author.bot) {
    return;
  }

  const guildSettings = await getGuildSettings(message.guild.id);

  if (!guildSettings) {
    const errorId = uuidv4();
    const channelError = new EmbedBuilder()
      .setColor(botColours.red)
      .setTitle("Error")
      .setDescription(
        `The guild settings could not be found for ${message.guild.name} (\`${message.guild.id}\`)\nPlease contact support with the following error ID\n\`${errorId}\``
      )
      .setTimestamp();

    const errorMessage = `Error ID: ${errorId}, Error Details: ${error.stack}\n`;
    fs.appendFile('errorLog.txt', errorMessage, (err) => {
      if (err) throw err;
    });

    const supportServer = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel("Support Server")
        .setStyle("Link")
        .setURL("https://discord.gg/BwD7MgVMuq")
    )

    return interaction.reply({ embeds: [channelError], components: [supportServer] });
  }

  if (!guildSettings.modules.levels.enabled) {

    return;

  }

  const now = Date.now();
  const cooldownKey = `${message.guild.id}-${message.author.id}`;
  const lastMessageTimestamp = cooldowns.get(cooldownKey) || 0;
  const cooldown = 60 * 1000; // 60 seconds in milliseconds

  if (now - lastMessageTimestamp < cooldown) {
    return;
  }

  cooldowns.set(cooldownKey, now);

  const xpGain = Math.floor(Math.random() * (30 - 10 + 1)) + 10; // Random XP between 10 and 30

  // Leveling logic here:
  const currentLevel = await getUserLevel(message.guild.id, message.author.id);
  await addUserXP(message.guild.id, message.author.id, xpGain); // Update XP first
  const newLevel = await getUserLevel(message.guild.id, message.author.id); // Then get the new level


  if (newLevel > currentLevel) {
    const embed = new EmbedBuilder()
      .setTitle('Level Up!')
      .setDescription(`Congratulations, <@${message.author.id}>! You leveled up to level \`${newLevel}\`! 🎉`)
      .setColor(botColours.purple)
      .setTimestamp();

    message.reply({ embeds: [embed] });
  }

  // Update the user's XP in the database
  await addUserXP(message.guild.id, message.author.id, xpGain);
}

module.exports = {
  handleExperienceGain,
};