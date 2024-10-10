require('dotenv').config();
const fs = require("node:fs");
const path = require("node:path");
const { Client, Collection, Events, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ChannelType,
  StringSelectMenuBuilder, StringSelectMenuOptionBuilder, SelectMenuBuilder, PermissionsBitField, ButtonStyle, ActivityType, IntegrationExpireBehavior, ApplicationCommandOptionWithChoicesAndAutocompleteMixin, SlashCommandStringOption, } = require("discord.js");
const { connectToDatabase, setupServerdata, wipeGuildSettings, getGuildSettings, enterGiveaway, logoutUser, getAllGiveaways, isUserBlacklisted, oauthCallbackData, fetchUserData, getBotGuilds, updateGuildModuleSettings, getUserAccessToGuild, isModuleEnabled, updateServerSettings, getTicketInfo, staffOauthCallbackData, fetchStaffUserData, saveMetricsData, closeDatabaseConnection, getGuildBotColours } = require("./database");
const { scheduleGiveawayEnd } = require('./giveawaySystem/verdictHandling.js');
const { handleBulkMessageDelete } = require("./messageHandlers/messageBulkDelete.js");
const { handleExperienceGain } = require("./leveingSystem/handleLeveling.js");
const { v4: uuidv4 } = require("uuid");
const express = require('express');
const cron = require('node-cron');
const axios = require('axios');
const { MongoClient, Long, ServerApiVersion, ConnectionPoolReadyEvent } = require('mongodb');


const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildEmojisAndStickers,
    GatewayIntentBits.GuildPresences,
  ],
  partials: ["MESSAGE", "CHANNEL", "REACTION"],
});

// In-memory metrics storage
let metrics = {
  commandsRun: 0,
  messagesSent: 0,
  errors: 0,
  latency: 0,
  uptime: 0
};

// Interval to flush metrics every minute
const metricsFlushInterval = 60000; // 1 minute

// A queue to store accumulated metrics changes
let metricsQueue = {
  commandsRun: 0,
  messagesSent: 0,
  errors: 0,
  latency: 0,
  uptime: 0,
};

// Helper function to aggregate metrics
function accumulateMetrics() {
  metricsQueue.commandsRun += metrics.commandsRun;
  metricsQueue.messagesSent += metrics.messagesSent;
  metricsQueue.errors += metrics.errors;
  metricsQueue.latency += metrics.latency;
  metricsQueue.uptime += metrics.uptime;

  // Reset in-memory metrics to avoid duplication
  metrics = {
    commandsRun: 0,
    messagesSent: 0,
    errors: 0,
    latency: 0,
    uptime: 0
  };
}

// Function to fetch guild count dynamically
function getGuildCount() {
  return client.guilds.cache.size;
}

// Function to fetch user count dynamically
function getUserCount() {
  return client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0);
}

// Function to flush metrics to the database
async function flushMetricsToDB() {
  try {
    const timestamp = new Date();
    const metricsData = {
      ...metricsQueue,
      guildCount: getGuildCount(),
      userCount: getUserCount(),
      timestamp,
    };
    await saveMetricsData(metricsData);  // Ensure saveMetricsData is async
    console.log("Metrics saved:", metricsData);

    // Reset metricsQueue after flushing
    metricsQueue = {
      commandsRun: 0,
      messagesSent: 0,
      errors: 0,
      latency: 0,
      uptime: 0,
    };
  } catch (error) {
    console.error("Error saving metrics:", error);
  }
}

// Set up interval to accumulate and flush metrics
setInterval(() => {
  accumulateMetrics();
  flushMetricsToDB();
}, metricsFlushInterval);

connectToDatabase()
  .then(() => {
    console.log("Connected to Scout Database");
  })
  .catch((err) => {
    console.error("Failed to connect to MongoDB", err);
  });


client.cooldowns = new Collection();

client.commands = new Collection();

const foldersPath = path.join(__dirname, "commands");
const commandFolders = fs.readdirSync(foldersPath);


for (const folder of commandFolders) {
  const commandsPath = path.join(foldersPath, folder);
  const commandFiles = fs
    .readdirSync(commandsPath)
    .filter((file) => file.endsWith(".js"));
  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);

    // Add the module name (folder name) to the command object
    command.moduleName = folder;

    if ("data" in command && "execute" in command) {
      // Add the category to the command's data
      command.data.category = folder;

      client.commands.set(command.data.name, command);
    } else {
      console.log(
        `[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`
      );
    }
  }
}



//Events

client.on("interactionCreate", async (interaction) => {
  const guildColours = await require('./database.js').getGuildBotColours(interaction.guild.id)
  if (interaction.isCommand()) {
    metrics.commandsRun++;
    const command = interaction.client.commands.get(interaction.commandName);

    if (!command) {
      console.error(
        `No command matching ${interaction.commandName} was found.`
      );
      return;
    }

    const { cooldowns } = interaction.client;

    if (!cooldowns.has(command.data.name)) {
      cooldowns.set(command.data.name, new Collection());
    }

    const now = Date.now();
    const timestamps = cooldowns.get(command.data.name);
    const defaultCooldownDuration = 3;
    const cooldownAmount = (command.cooldown ?? defaultCooldownDuration) * 1_000;

    if (timestamps.has(interaction.user.id)) {
      const expirationTime = timestamps.get(interaction.user.id) + cooldownAmount;

      if (now < expirationTime) {
        const expiredTimestamp = Math.round(expirationTime / 1_000);
        return interaction.reply({ content: `Please wait, you are on a cooldown for \`${command.data.name}\`. You can use it again <t:${expiredTimestamp}:R>.`, ephemeral: true });
      }
    }

    timestamps.set(interaction.user.id, now);
    setTimeout(() => timestamps.delete(interaction.user.id), cooldownAmount);

    const moduleName = command.moduleName;

    if (moduleName !== 'usage') {
      const moduleEnabledStatus = await isModuleEnabled(interaction.guild.id, moduleName);

      if (!moduleEnabledStatus) {
        const embed = new EmbedBuilder()
          .setColor(guildColours.warning)
          .setTitle(`Module Disabled`)
          .setDescription(`The ${moduleName} module is currently disabled.`);

        return interaction.reply({ embeds: [embed], ephemeral: true });
      }
    }

    if (command.permission) {
      if (
        interaction.member.id === interaction.guild.ownerId ||
        interaction.member.permissions.has(
          PermissionsBitField.Flags.Administrator
        )
      ) {
        try {
          await command.execute(interaction);
        } catch (error) {
          metrics.errors++;
          console.error(error);
          if (interaction.replied || interaction.deferred) {
            await interaction.followUp({
              content: "There was an error while executing this command!",
              ephemeral: true,
            });
          } else {
            await interaction.reply({
              content: "There was an error while executing this command!",
              ephemeral: true,
            });
          }
        }
        return;
      }

      const guildSettings = await getGuildSettings(interaction.guild.id);

      if (!guildSettings) {
        return interaction.reply({
          content: "The guild settings could not be found.",
          ephemeral: true,
        });
      }

      if (!guildSettings.rolePermissions) {
        return interaction.reply({
          content:
            "This command cannot be executed due to missing permissions configuration.",
          ephemeral: true,
        });
      }

      const userRoles = interaction.member.roles.cache.map((role) => role.id);

      // Check if the user has a god role
      if (
        userRoles.some((role) =>
          guildSettings.rolePermissions.godRoles
            .map((godRole) => godRole.$numberLong)
            .includes(role.id)
        )
      ) {
        try {
          await command.execute(interaction);
        } catch (error) {
          metrics.errors++;
          console.error(error);
          if (interaction.replied || interaction.deferred) {
            await interaction.followUp({
              content: "There was an error while executing this command!",
              ephemeral: true,
            });
          } else {
            await interaction.reply({
              content: "There was an error while executing this command!",
              ephemeral: true,
            });
          }
        }
        return;
      }

      // Check if all permissions required by the command are present in guildSettings.rolePermissions
      if (
        !command.permission.every((permission) =>
          guildSettings.rolePermissions.hasOwnProperty(permission)
        )
      ) {
        return interaction.reply({
          content:
            "This command cannot be executed due to missing permissions configuration.",
          ephemeral: true,
        });
      }

      // Check if the user's roles have all the required permissions
      const hasPermission = command.permission.every((permission) =>
        interaction.member.roles.cache.some((role) =>
          guildSettings.rolePermissions[permission].includes(role.id)
        )
      );

      if (!hasPermission) {
        return interaction.reply({
          content:
            "You do not have the required permissions to run this command.",
          ephemeral: true,
        });
      }
    }

    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(error);
      if (interaction.replied || interaction.deferred) {
        metrics.errors++;
        await interaction.followUp({
          content: "There was an error while executing this command!",
          ephemeral: true,
        });
      } else {
        await interaction.reply({
          content: "There was an error while executing this command!",
          ephemeral: true,
        });
      }
    }
  } else if (interaction.isButton()) {
    if (interaction.customId === 'enter_giveaway') {

      console.log(interaction.user.id, interaction.message.id)
      const giveawayData = await enterGiveaway(interaction.user.id, interaction.message.id);

      if (giveawayData === "notFound") {
        await interaction.reply({ content: 'This giveaway does not exist, Sorry!', ephemeral: true });
      } else if (giveawayData === "alreadyEntered") {
        await interaction.reply({ content: 'You have already entered this giveaway!', ephemeral: true });
      } else if (giveawayData === "entered") {
        await interaction.reply({ content: 'You have successfully entered the giveaway!', ephemeral: true });
      }
    }
  }
});

client.on("messageCreate", async (message) => {
  metrics.messagesSent++;
  handleExperienceGain(message);
});

client.on("messageDeleteBulk", async (messages) => {

  handleBulkMessageDelete(messages, client);
});

client.on("guildCreate", async (guild) => {
  const guildColours = await require('./database.js').getGuildBotColours(guild.id)

  const isUserBlacklisted = await isUserBlacklisted(guild.ownerId);

  if (isUserBlacklisted) {

    const embed = new EmbedBuilder()
      .setColor(guildColours.error)
      .setTitle(`You have been blacklisted from Scout.`)
      .setDescription('You are unable to add Scout to your server due to being blacklisted.')
      .addFields(
        { name: "Reason:", value: isUserBlacklisted.Reason },
        { name: "Timestamp:", value: isUserBlacklisted.DateTime }
      )
      .setTimestamp()
      .setFooter({
        text: `To appeal, please join our Support Server and create a ticket`,
      });

    const supportServer = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel("Support Server")
        .setStyle("Link")
        .setURL("https://discord.gg/BwD7MgVMuq")
    );

    const firstChannel = guild.channels.cache
      .filter(
        (c) =>
          c.type === ChannelType.GuildText &&
          c.permissionsFor(guild.members.me).has("SendMessages")
      )
      .sort((a, b) => a.position - b.position)
      .first();

    if (firstChannel) {
      await firstChannel.send({ embeds: [embed], components: [supportServer] });
    } else {
      console.log(
        "Channels in the guild:",
        guild.channels.cache.map((channel) => `${channel.name} (${channel.type})`)
      );
      console.log(
        `No suitable channel found to send message in guild ${guild.id}`
      );
    }
    guild.leave();
    return;


  }

  const embed = new EmbedBuilder()
    .setColor(guildColours.success) // Make sure guildColours.success is defined
    .setTitle(`Welcome to Scout!`)
    .setDescription(
      `Thank you for inviting Scout to your server! Please ask Moose for assistance with setting up in your server's channel in our discord server.`
    )
    .setTimestamp();

  const supportServer = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel("Support Server")
      .setStyle("Link")
      .setURL("https://discord.gg/BwD7MgVMuq")
  );

  const firstChannel = guild.channels.cache
    .filter(
      (c) =>
        c.type === ChannelType.GuildText &&
        c.permissionsFor(guild.members.me).has("SendMessages")
    )
    .sort((a, b) => a.position - b.position)
    .first();

  if (firstChannel) {
    await firstChannel.send({ embeds: [embed], components: [supportServer] });
  } else {
    console.log(
      "Channels in the guild:",
      guild.channels.cache.map((channel) => `${channel.name} (${channel.type})`)
    );
    console.log(
      `No suitable channel found to send message in guild ${guild.id}`
    );
  }

  setupServerdata(guildid);
});

client.on('guildDelete', guild => {
  metrics.guildCount--;
  metrics.userCount -= guild.memberCount;
});

client.on("messageDelete", async (message) => {
  if (message.partial) {
    try {
      message = await message.fetch();
    } catch (error) {
      console.error("Something went wrong when fetching the message: ", error);
      return;
    }
  }

  if (message.author.bot) return;

  const guildSettings = await getGuildSettings(message.guild.id);
  const guildColours = await require('./database.js').getGuildBotColours(message.guild.id)



  if (!guildSettings) {
    const errorId = uuidv4();
    const channelError = new EmbedBuilder()
      .setColor(guildColours.error)
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
    );
    const firstChannel = message.guild.channels.cache
      .filter(
        (c) =>
          c.type === ChannelType.GuildText &&
          c.permissionsFor(message.guild.members.me).has("SendMessages")
      )
      .sort((a, b) => a.position - b.position)
      .first();

    if (firstChannel) {
      await firstChannel.send({
        embeds: [channelError],
        components: [supportServer],
      });
    } else {
      console.log(
        "Channels in the guild:",
        guild.channels.cache.map(
          (channel) => `${channel.name} (${channel.type})`
        )
      );
      console.log(
        `No suitable channel found to send message in guild ${guild.id}`
      );
    }
  }



  if (!guildSettings.modules.logging.enabled) return;

  if (!guildSettings.modules.logging.loggingChannels.message) return;

  const loggingChannel = message.guild.channels.cache.get(
    guildSettings.modules.logging.loggingChannels.message
  );

  if (!loggingChannel) return;

  const embed = new EmbedBuilder()
    .setColor(guildColours.error)
    .setTitle("Message Deleted")
    .setDescription("A message was deleted.")
    .addFields(
      {
        name: "User:",
        value: `<@${message.author.id}> (${message.author.id})`,
      },
      {
        name: "Channel:",
        value: `<#${message.channel.id}> (${message.channel.id})`,
      }
    )
    .setTimestamp();

  // Split the message into chunks of 1024 characters
  const messageChunks = message.content.match(/[\s\S]{1,1024}/g) || ["None"];

  // Add each chunk as a separate field
  // Add each chunk as a separate field
  const messageFields = messageChunks.map((chunk, index) => ({
    name: messageChunks.length === 1 ? 'Message:' : `Message (Part ${index + 1}):`,
    value: chunk,
  }));

  embed.addFields(messageFields);

  loggingChannel.send({ embeds: [embed] });
});

client.on("voiceStateUpdate", async (oldState, newState) => {

  if (oldState.channelId === newState.channelId) return;

  const guildSettings = await getGuildSettings(oldState.guild.id);
  const guildColours = await require('./database.js').getGuildBotColours(oldState.guild.id)

  if (!guildSettings) {
    const errorId = uuidv4();
    const channelError = new EmbedBuilder()
      .setColor(guildColours.error)
      .setTitle("Error")
      .setDescription(
        `The guild settings could not be found for ${oldMessage.guild.name} (\`${oldMessage.guild.id}\`)\nPlease contact support with the following error ID\n\`${errorId}\``
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
    );
    const firstChannel = oldMessage.guild.channels.cache
      .filter(
        (c) =>
          c.type === ChannelType.GuildText &&
          c.permissionsFor(oldMessage.guild.members.me).has("SendMessages")
      )
      .sort((a, b) => a.position - b.position)
      .first();

    if (firstChannel) {
      await firstChannel.send({
        embeds: [channelError],
        components: [supportServer],
      });
    } else {
      console.log(
        "Channels in the guild:",
        guild.channels.cache.map(
          (channel) => `${channel.name} (${channel.type})`
        )
      );
      console.log(
        `No suitable channel found to send message in guild ${guild.id}`
      );
    }
  }



  if (guildSettings.modules.logging && guildSettings.modules.logging.loggingChannels.voice) {



    let action, oldChannel, newChannel;

    if (!oldState.channel && newState.channel) {
      action = 'joined';
      newChannel = newState.channel;
    } else if (oldState.channel && !newState.channel) {
      action = 'left';
      oldChannel = oldState.channel;
    } else if (oldState.channel && newState.channel) {
      action = 'switched from';
      oldChannel = oldState.channel;
      newChannel = newState.channel;
    } else {
      return;
    }

    const logChannel = client.channels.cache.get(guildSettings.modules.logging.loggingChannels.voice);
    if (!logChannel) return; // Ignore if the log channel doesn't exist

    let embed;
    if (action === 'switched from') {
      embed = new EmbedBuilder()
        .setTitle('Voice Channel Update')
        .setDescription(`${newState.member} has ${action} ${oldChannel} to ${newChannel}.`)
        .setColor(guildColours.warning)
        .setTimestamp();
    } else {
      const channel = action === 'joined' ? newChannel : oldChannel;
      embed = new EmbedBuilder()
        .setTitle('Voice Channel Update')
        .setDescription(`${newState.member} has ${action} the voice channel ${channel}.`)
        .setColor(guildColours.warning)
        .setTimestamp();
    }

    logChannel.send({ embeds: [embed] });
  }
});

client.on("messageUpdate", async (oldMessage, newMessage) => {
  const guildColours = await require('./database.js').getGuildBotColours(oldMessage.guild.id)

  if (oldMessage.partial) {
    try {
      oldMessage = await oldMessage.fetch();
    } catch (error) {
      console.error("Something went wrong when fetching the message: ", error);
      return;
    }
  }

  if (newMessage.partial) {
    try {
      newMessage = await newMessage.fetch();
    } catch (error) {
      console.error("Something went wrong when fetching the message: ", error);
      return;
    }
  }

  if (oldMessage.author.bot) return;

  if (oldMessage.content === newMessage.content) return;

  const guildSettings = await getGuildSettings(oldMessage.guild.id);

  if (!guildSettings) {
    const errorId = uuidv4();
    const channelError = new EmbedBuilder()
      .setColor(guildColours.error)
      .setTitle("Error")
      .setDescription(
        `The guild settings could not be found for ${oldMessage.guild.name} (\`${oldMessage.guild.id}\`)\nPlease contact support with the following error ID\n\`${errorId}\``
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
    );
    const firstChannel = oldMessage.guild.channels.cache
      .filter(
        (c) =>
          c.type === ChannelType.GuildText &&
          c.permissionsFor(oldMessage.guild.members.me).has("SendMessages")
      )
      .sort((a, b) => a.position - b.position)
      .first();

    if (firstChannel) {
      await firstChannel.send({
        embeds: [channelError],
        components: [supportServer],
      });
    } else {
      console.log(
        "Channels in the guild:",
        guild.channels.cache.map(
          (channel) => `${channel.name} (${channel.type})`
        )
      );
      console.log(
        `No suitable channel found to send message in guild ${guild.id}`
      );
    }
  }

  if (!guildSettings.modules.logging.enabled) return;

  if (!guildSettings.modules.logging.loggingChannels.message) return;

  const loggingChannel = oldMessage.guild.channels.cache.get(
    guildSettings.modules.logging.loggingChannels.message
  );

  if (!loggingChannel) return;

  const embed = new EmbedBuilder()
    .setColor(guildColours.warning)
    .setTitle("Message Edited")
    .setDescription("A message was edited.")
    .addFields(
      {
        name: "User:",
        value: `<@${oldMessage.author.id}> (${oldMessage.author.id})`,
      },
      {
        name: "Channel:",
        value: `<#${oldMessage.channel.id}> (${oldMessage.channel.id})`,
      },
      {
        name: "Old Message:",
        value: oldMessage.content.length ? oldMessage.content : "None",
      },
      {
        name: "New Message:",
        value: newMessage.content.length ? newMessage.content : "None",
      }
    )
    .setTimestamp();

  const actionRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel("Jump to Message")
      .setStyle("Link")
      .setURL(newMessage.url)
  );

  loggingChannel.send({ embeds: [embed], components: [actionRow] });
});

client.on('guildMemberAdd', async (member) => {
  const guild = member.guild;
  const guildId = guild.id;
  const guildColours = await require('./database.js').getGuildBotColours(guildId)
  const guildSettings = await getGuildSettings(guildId);

  const welcomeMessages = guildSettings.modules.welcomeMessages;

  if (!guildSettings) {
    const errorId = uuidv4();
    const channelError = new EmbedBuilder()
      .setColor(guildColours.error)
      .setTitle("Error")
      .setDescription(
        `The guild settings could not be found for ${member.guild.name} (\`${member.guild.id}\`)\n\nPlease contact support with the following error ID\n\`${errorId}\``
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
    );
    const firstChannel = member.guild.channels.cache
      .filter(
        (c) =>
          c.type === ChannelType.GuildText &&
          c.permissionsFor(member.guild.members.me).has("SendMessages")
      )
      .sort((a, b) => a.position - b.position)
      .first();

    if (firstChannel) {
      await firstChannel.send({
        embeds: [channelError],
        components: [supportServer],
      });
    } else {
      console.log(
        "Channels in the guild:",
        guild.channels.cache.map(
          (channel) => `${channel.name} (${channel.type})`
        )
      );
      console.log(
        `No suitable channel found to send message in guild ${guild.id}`
      );
    }
  }

  if (!welcomeMessages.enabled) return; //if module is disabled, return

  const messageChannel = guild.channels.cache.get(welcomeMessages.channelId);


  if (!messageChannel) {
    const error = new EmbedBuilder()
      .setColor(guildColours.error)
      .setTitle('Error')
      .setDescription('The welcome channel could not be found.')
      .setTimestamp();

    const firstChannel = member.guild.channels.cache
      .filter(
        (c) =>
          c.type === ChannelType.GuildText &&
          c.permissionsFor(member.guild.members.me).has("SendMessages")
      )
      .sort((a, b) => a.position - b.position)
      .first();

    if (firstChannel) {
      await firstChannel.send({
        embeds: [error],
      });
    } else {
      console.log(
        "Channels in the guild:",
        guild.channels.cache.map(
          (channel) => `${channel.name} (${channel.type})`
        )
      );
      console.log(
        `No suitable channel found to send message in guild ${guild.id}`
      );
      return;
    }
  }



  if (welcomeMessages.enabled) {
    const welcomeChannel = guild.channels.cache.get(welcomeMessages.channelId);
    if (!welcomeChannel) {
      console.error(`Channel with ID ${welcomeMessages.channelId} not found or the bot does not have access to it`);
      return;
    }

    if (welcomeMessages.message.embed.enabled) {
      const embedData = welcomeMessages.message.embed;
      const embed = new EmbedBuilder()
        .setTitle(embedData.title
          .replace('<userName>', member.user.username)
          .replace('<serverName>', guild.name)
          .replace('<date>', new Date().toLocaleDateString())
          .replace('<userId>', member.user.id)
          .replace('<memberCount>', guild.memberCount)
          .replace('<serverId>', guildId)
          .replace('<mentionUser>', `<@${member.user.id}>`)
        )
        .setDescription(
          embedData.description
            .replace('<userName>', member.user.username)
            .replace('<serverName>', guild.name)
            .replace('<date>', new Date().toLocaleDateString())
            .replace('<userId>', member.user.id)
            .replace('<memberCount>', guild.memberCount)
            .replace('<serverId>', guildId)
            .replace('<mentionUser>', `<@${member.user.id}>`)
        )
        .setColor(embedData.color);

      if (embedData.thumbnail.enabled) {
        let thumbnailUrl = '';
        if (embedData.thumbnail.profilePicture) {
          thumbnailUrl = member.user.displayAvatarURL();
        } else if (embedData.thumbnail.serverIcon) {
          thumbnailUrl = guild.iconURL();
        } else {
          thumbnailUrl = embedData.thumbnail.url;
        }
        embed.setThumbnail(thumbnailUrl);
      }

      welcomeChannel.send({ embeds: [embed] });
    } else if (welcomeMessages.message.text.enabled) {
      const text = welcomeMessages.message.text.content
        .replace('<userName>', member.user.username)
        .replace('<serverName>', guild.name)
        .replace('<date>', new Date().toLocaleDateString())
        .replace('<userId>', member.user.id)
        .replace('<memberCount>', guild.memberCount)
        .replace('<serverId>', guildId)
        .replace('<mentionUser>', `<@${member.user.id}>`)

      welcomeChannel.send(text);
    }
  }
});

client.on('guildMemberRemove', async (member) => {
  const guild = member.guild;
  const guildId = guild.id;
  const guildSettings = await getGuildSettings(guildId);
  const guildColours = await require('./database.js').getGuildBotColours(guildId);

  const leaveMessages = guildSettings.modules.leaveMessages;

  if (!guildSettings) {
    const errorId = uuidv4();
    const channelError = new EmbedBuilder()
      .setColor(guildColours.error)
      .setTitle("Error")
      .setDescription(
        `The guild settings could not be found for ${member.guild.name} (\`${member.guild.id}\`)\n\nPlease contact support with the following error ID\n\`${errorId}\``
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
    );
    const firstChannel = member.guild.channels.cache
      .filter(
        (c) =>
          c.type === ChannelType.GuildText &&
          c.permissionsFor(member.guild.members.me).has("SendMessages")
      )
      .sort((a, b) => a.position - b.position)
      .first();

    if (firstChannel) {
      await firstChannel.send({
        embeds: [channelError],
        components: [supportServer],
      });
    } else {
      console.log(
        "Channels in the guild:",
        guild.channels.cache.map(
          (channel) => `${channel.name} (${channel.type})`
        )
      );
      console.log(
        `No suitable channel found to send message in guild ${guild.id}`
      );
    }
  }

  if (!leaveMessages.enabled) return; //if module is disabled, return

  const messageChannel = guild.channels.cache.get(leaveMessages.channelId);

  if (!messageChannel) {
    const error = new EmbedBuilder()
      .setColor(guildColours.error)
      .setTitle('Error')
      .setDescription('The leave channel could not be found.')
      .setTimestamp();

    const firstChannel = member.guild.channels.cache
      .filter(
        (c) =>
          c.type === ChannelType.GuildText &&
          c.permissionsFor(member.guild.members.me).has("SendMessages")
      )
      .sort((a, b) => a.position - b.position)
      .first();

    if (firstChannel) {
      await firstChannel.send({
        embeds: [error],
      });
    } else {
      console.log(
        "Channels in the guild:",
        guild.channels.cache.map(
          (channel) => `${channel.name} (${channel.type})`
        )
      );
      console.log(
        `No suitable channel found to send message in guild ${guild.id}`
      );
      return;
    }
  }


  if (leaveMessages.enabled) {
    const leaveChannel = guild.channels.cache.get(leaveMessages.channelId);
    if (!leaveChannel) {
      console.error(`Channel with ID ${leaveMessages.channelId} not found or the bot does not have access to it`);
      return;
    }

    if (leaveMessages.message.embed.enabled) {
      const embedData = leaveMessages.message.embed;
      const embed = new EmbedBuilder()
        .setTitle(embedData.title
          .replace('<userName>', member.user.username)
          .replace('<serverName>', guild.name)
          .replace('<date>', new Date().toLocaleDateString())
          .replace('<userId>', member.user.id)
          .replace('<memberCount>', guild.memberCount)
          .replace('<serverId>', guildId)
          .replace('<mentionUser>', `<@${member.user.id}>`)
        )
        .setDescription(
          embedData.description
            .replace('<userName>', member.user.username)
            .replace('<serverName>', guild.name)
            .replace('<date>', new Date().toLocaleDateString())
            .replace('<userId>', member.user.id)
            .replace('<memberCount>', guild.memberCount)
            .replace('<serverId>', guildId)
            .replace('<mentionUser>', `<@${member.user.id}>`)
        )
        .setColor(embedData.color);

      if (embedData.thumbnail.enabled) {
        let thumbnailUrl = '';
        if (embedData.thumbnail.profilePicture) {
          thumbnailUrl = member.user.displayAvatarURL();
        } else if (embedData.thumbnail.serverIcon) {
          thumbnailUrl = guild.iconURL();
        } else {
          thumbnailUrl = embedData.thumbnail.url;
        }
        embed.setThumbnail(thumbnailUrl);
      }

      leaveChannel.send({ embeds: [embed] });
    } else if (leaveMessages.message.text.enabled) {
      const text = leaveMessages.message.text.content
        .replace('<userName>', member.user.username)
        .replace('<serverName>', guild.name)
        .replace('<date>', new Date().toLocaleDateString())
        .replace('<userId>', member.user.id)
        .replace('<memberCount>', guild.memberCount)
        .replace('<serverId>', guildId)
        .replace('<mentionUser>', `<@${member.user.id}>`)

      leaveChannel.send(text);
    }
  }

});

client.on('roleCreate', async (role) => {
  const guild = role.guild;
  const guildId = guild.id;
  const guildColours = await require('./database.js').getGuildBotColours(guildId);
  const guildSettings = await getGuildSettings(guildId);

  if (!guildSettings) {
    const errorId = uuidv4();
    const channelError = new EmbedBuilder()
      .setColor(guildColours.error)
      .setTitle("Error")
      .setDescription(
        `The guild settings could not be found for ${guild.name} (\`${guild.id}\`)\n\nPlease contact support with the following error ID\n\`${errorId}\``
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
    );
    const firstChannel = guild.channels.cache
      .filter(
        (c) =>
          c.type === ChannelType.GuildText &&
          c.permissionsFor(guild.members.me).has("SendMessages")
      )
      .sort((a, b) => a.position - b.position)
      .first();

    if (firstChannel) {
      await firstChannel.send({
        embeds: [channelError],
        components: [supportServer],
      });
    } else {
      console.log(
        "Channels in the guild:",
        guild.channels.cache.map(
          (channel) => `${channel.name} (${channel.type})`
        )
      );
      console.log(
        `No suitable channel found to send message in guild ${guild.id}`
      );
    }
  }

  if (!guildSettings.modules.logging.enabled) return;

  if (!guildSettings.modules.logging.loggingChannels.serverChanges) return;

  const logChannel = guild.channels.cache.get(
    guildSettings.modules.logging.loggingChannels.serverChanges
  );

  if (!logChannel) return;

  let fields = [
    {
      name: "Role:",
      value: `${role.name} (${role.id})`,
    },
  ];

  let permissions = role.permissions.toArray();
  if (permissions.length > 0) {
    fields.push({
      name: "Role Permissions:",
      value: permissions.join(", "),
    });
  }

  const embed = new EmbedBuilder()
    .setColor(guildColours.warning)
    .setTitle("Role Created")
    .setDescription("A role was created.")
    .addFields(fields)
    .setTimestamp();

  logChannel.send({ embeds: [embed] });

});


client.on('roleUpdate', async (oldRole, newRole) => {
  const guild = newRole.guild;
  const guildId = guild.id;
  const guildColours = await require('./database.js').getGuildBotColours(guildId);
  const guildSettings = await getGuildSettings(guildId);

  if (!guildSettings) {
    const errorId = uuidv4();
    const channelError = new EmbedBuilder()
      .setColor(guildColours.error)
      .setTitle("Error")
      .setDescription(
        `The guild settings could not be found for ${guild.name} (\`${guild.id}\`)\n\nPlease contact support with the following error ID\n\`${errorId}\``
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
    );
    const firstChannel = guild.channels.cache
      .filter(
        (c) =>
          c.type === ChannelType.GuildText &&
          c.permissionsFor(guild.members.me).has("SendMessages")
      )
      .sort((a, b) => a.position - b.position)
      .first();

    if (firstChannel) {
      await firstChannel.send({
        embeds: [channelError],
        components: [supportServer],
      });
    } else {
      console.log(
        "Channels in the guild:",
        guild.channels.cache.map(
          (channel) => `${channel.name} (${channel.type})`
        )
      );
      console.log(
        `No suitable channel found to send message in guild ${guild.id}`
      );
    }
  }

  if (!guildSettings.modules.logging.enabled) return;

  if (!guildSettings.modules.logging.loggingChannels.serverChanges) return;

  const logChannel = guild.channels.cache.get(
    guildSettings.modules.logging.loggingChannels.serverChanges
  );

  if (!logChannel) return;

  let fields = [
    {
      name: "Role:",
      value: `${newRole.name} (${newRole.id})`,
    },
  ];

  if (oldRole.name !== newRole.name) {
    fields.push(
      {
        name: "Name:",
        value: `${oldRole.name} -> ${newRole.name}`
      }
    );
  }

  if (oldRole.color !== newRole.color) {
    fields.push(
      {
        name: "Colour:",
        value: `${oldRole.color.toString(16)} -> ${newRole.color.toString(16)}`,
      }
    );
  }

  if (oldRole.hoist !== newRole.hoist) {
    fields.push(
      {
        name: "Hoisted:",
        value: `${oldRole.hoist.toString()} -> ${newRole.hoist.toString()}`,
      }
    );
  }

  if (oldRole.mentionable !== newRole.mentionable) {
    fields.push(
      {
        name: "Mentionable:",
        value: `${oldRole.mentionable.toString()} -> ${newRole.mentionable.toString()}`,
      }
    );
  }

  let oldPermissions = oldRole.permissions.toArray();
  let newPermissions = newRole.permissions.toArray();

  let addedPermissions = newPermissions.filter(permission => !oldPermissions.includes(permission));
  let removedPermissions = oldPermissions.filter(permission => !newPermissions.includes(permission));

  if (addedPermissions.length > 0) {
    fields.push({
      name: "Added Permissions:",
      value: addedPermissions.map(permission => `+${permission}`).join(", "),
    });
  }

  if (removedPermissions.length > 0) {
    fields.push({
      name: "Removed Permissions:",
      value: removedPermissions.map(permission => `-${permission}`).join(", "),
    });
  }

  const embed = new EmbedBuilder()
    .setColor(guildColours.warning)
    .setTitle("Role Updated")
    .setDescription("A role was updated.")
    .addFields(fields)
    .setTimestamp();

  logChannel.send({ embeds: [embed] });

});

client.on('roleDelete', async (role) => {
  const guild = role.guild;
  const guildId = guild.id;
  const guildColours = await require('./database.js').getGuildBotColours(guildId);
  const guildSettings = await getGuildSettings(guildId);

  if (!guildSettings) {
    const errorId = uuidv4();
    const channelError = new EmbedBuilder()
      .setColor(guildColours.error)
      .setTitle("Error")
      .setDescription(
        `The guild settings could not be found for ${guild.name} (\`${guild.id}\`)\n\nPlease contact support with the following error ID\n\`${errorId}\``
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
    );
    const firstChannel = guild.channels.cache
      .filter(
        (c) =>
          c.type === ChannelType.GuildText &&
          c.permissionsFor(guild.members.me).has("SendMessages")
      )
      .sort((a, b) => a.position - b.position)
      .first();

    if (firstChannel) {
      await firstChannel.send({
        embeds: [channelError],
        components: [supportServer],
      });
    } else {
      console.log(
        "Channels in the guild:",
        guild.channels.cache.map(
          (channel) => `${channel.name} (${channel.type})`
        )
      );
      console.log(
        `No suitable channel found to send message in guild ${guild.id}`
      );
    }
  }

  if (!guildSettings.modules.logging.enabled) return;

  if (!guildSettings.modules.logging.loggingChannels.serverChanges) return;

  const logChannel = guild.channels.cache.get(
    guildSettings.modules.logging.loggingChannels.serverChanges
  );

  if (!logChannel) return;

  let fields = [
    {
      name: "Role:",
      value: `${role.name} (${role.id})`,
    },
  ];

  let permissions = role.permissions.toArray();
  if (permissions.length > 0) {
    fields.push({
      name: "Role Permissions:",
      value: permissions.join(", "),
    });
  }

  const embed = new EmbedBuilder()
    .setColor(guildColours.error)
    .setTitle("Role Deleted")
    .setDescription("A role was deleted.")
    .addFields(fields)
    .setTimestamp();

  logChannel.send({ embeds: [embed] });

});


client.on('channelCreate', async (channel) => {
  const guild = channel.guild;
  const guildId = guild.id;
  const guildColours = await require('./database.js').getGuildBotColours(guildId);
  const guildSettings = await getGuildSettings(guildId);

  if (!guildSettings) {
    const errorId = uuidv4();
    const channelError = new EmbedBuilder()
      .setColor(guildColours.error)
      .setTitle("Error")
      .setDescription(
        `The guild settings could not be found for ${guild.name} (\`${guild.id}\`)\n\nPlease contact support with the following error ID\n\`${errorId}\``
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
    );
    const firstChannel = guild.channels.cache
      .filter(
        (c) =>
          c.type === ChannelType.GuildText &&
          c.permissionsFor(guild.members.me).has("SendMessages")
      )
      .sort((a, b) => a.position - b.position)
      .first();

    if (firstChannel) {
      await firstChannel.send({
        embeds: [channelError],
        components: [supportServer],
      });
    } else {
      console.log(
        "Channels in the guild:",
        guild.channels.cache.map(
          (channel) => `${channel.name} (${channel.type})`
        )
      );
      console.log(
        `No suitable channel found to send message in guild ${guild.id}`
      );
    }
  }

  if (!guildSettings.modules.logging.enabled) return;

  if (!guildSettings.modules.logging.loggingChannels.serverChanges) return;

  const logChannel = guild.channels.cache.get(
    guildSettings.modules.logging.loggingChannels.serverChanges
  );

  if (!logChannel) return;



  let channelType;
  switch (channel.type) {
    case 0:
      channelType = 'GUILD_TEXT';
      break;
    case 2:
      channelType = 'GUILD_VOICE';
      break;
    case 4:
      channelType = 'GUILD_CATEGORY';
      break;
    case 5:
      channelType = 'GUILD_ANNOUNCEMENT';
      break;
    case 10:
      channelType = 'ANNOUNCEMENT_THREAD';
      break;
    case 11:
      channelType = 'PUBLIC_THREAD';
      break;
    case 12:
      channelType = 'PRIVATE_THREAD';
      break;
    case 13:
      channelType = 'GUILD_STAGE_VOICE';
      break;
    case 14:
      channelType = 'GUILD_DIRECTORY';
      break;
    case 15:
      channelType = 'GUILD_FORUM';
      break;
    case 16:
      channelType = 'GUILD_MEDIA';
      break;
    default:
      channelType = 'Unknown';
  }

  let fields = [
    {
      name: "Channel:",
      value: `${channel.name} (${channel.id})`,
    },
    {
      name: "Type:",
      value: channelType,
    },
  ];

  if (channel.type === 0) { // GUILD_TEXT
    fields.push({
      name: "Category:",
      value: channel.parent ? `${channel.parent.name} (${channel.parent.id})` : "None",
    });
  }

  const embed = new EmbedBuilder()
    .setColor(guildColours.warning)
    .setTitle("Channel Created")
    .setDescription("A channel was created.")
    .addFields(fields)
    .setTimestamp();

  logChannel.send({ embeds: [embed] });
});


client.on('channelUpdate', async (oldChannel, newChannel) => {

  if (
    oldChannel.name === newChannel.name &&
    oldChannel.parent === newChannel.parent &&
    oldChannel.nsfw === newChannel.nsfw &&
    oldChannel.type === newChannel.type &&
    oldChannel.rateLimitPerUser === newChannel.rateLimitPerUser
  ) {
    return;
  }

  const guild = newChannel.guild;
  const guildId = guild.id;
  const guildColours = await require('./database.js').getGuildBotColours(guildId);
  const guildSettings = await getGuildSettings(guildId);

  if (!guildSettings) {
    const errorId = uuidv4();
    const channelError = new EmbedBuilder()
      .setColor(guildColours.error)
      .setTitle("Error")
      .setDescription(
        `The guild settings could not be found for ${guild.name} (\`${guild.id}\`)\n\nPlease contact support with the following error ID\n\`${errorId}\``
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
    );
    const firstChannel = guild.channels.cache
      .filter(
        (c) =>
          c.type === ChannelType.GuildText &&
          c.permissionsFor(guild.members.me).has("SendMessages")
      )
      .sort((a, b) => a.position - b.position)
      .first();

    if (firstChannel) {
      await firstChannel.send({
        embeds: [channelError],
        components: [supportServer],
      });
    } else {
      console.log(
        "Channels in the guild:",
        guild.channels.cache.map(
          (channel) => `${channel.name} (${channel.type})`
        )
      );
      console.log(
        `No suitable channel found to send message in guild ${guild.id}`
      );
    }
  }

  if (!guildSettings.modules.logging.enabled) return;

  if (!guildSettings.modules.logging.loggingChannels.serverChanges) return;

  const logChannel = guild.channels.cache.get(
    guildSettings.modules.logging.loggingChannels.serverChanges
  );

  if (!logChannel) return;

  let fields = [
    {
      name: "Channel:",
      value: `${newChannel.name} (${newChannel.id})`,
    },
  ];

  if (oldChannel.name !== newChannel.name) {
    fields.push(
      {
        name: "Name:",
        value: `${oldChannel.name} -> ${newChannel.name}`
      }
    );
  }

  if (oldChannel.parent !== newChannel.parent) {
    fields.push(
      {
        name: "Category:",
        value: `${oldChannel.parent ? `${oldChannel.parent.name} (${oldChannel.parent.id})` : "None"} -> ${newChannel.parent ? `${newChannel.parent.name} (${newChannel.parent.id})` : "None"}`
      }
    );
  }

  if (oldChannel.nsfw !== newChannel.nsfw) {
    fields.push(
      {
        name: "NSFW:",
        value: `${oldChannel.nsfw} -> ${newChannel.nsfw}`
      }
    );
  }

  if (oldChannel.type !== newChannel.type && (oldChannel.type === 5 || newChannel.type === 5)) {
    fields.push(
      {
        name: "Announcement:",
        value: `${oldChannel.type === 5} -> ${newChannel.type === 5}`
      }
    );
  }

  if (oldChannel.rateLimitPerUser !== newChannel.rateLimitPerUser && newChannel.type !== 5) {
    fields.push(
      {
        name: "Slowmode:",
        value: `${oldChannel.rateLimitPerUser} -> ${newChannel.rateLimitPerUser}`
      }
    );
  }

  const embed = new EmbedBuilder()
    .setColor(guildColours.warning)
    .setTitle("Channel Updated")
    .setDescription("A channel was updated.")
    .addFields(fields)
    .setTimestamp();

  logChannel.send({ embeds: [embed] });
});

client.on('channelDelete', async (channel) => {
  const guild = channel.guild;
  const guildId = guild.id;
  const guildColours = await require('./database.js').getGuildBotColours(guildId);
  const guildSettings = await getGuildSettings(guildId);

  if (!guildSettings) {
    const errorId = uuidv4();
    const channelError = new EmbedBuilder()
      .setColor(guildColours.error)
      .setTitle("Error")
      .setDescription(
        `The guild settings could not be found for ${guild.name} (\`${guild.id}\`)\n\nPlease contact support with the following error ID\n\`${errorId}\``
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
    );
    const firstChannel = guild.channels.cache
      .filter(
        (c) =>
          c.type === ChannelType.GuildText &&
          c.permissionsFor(guild.members.me).has("SendMessages")
      )
      .sort((a, b) => a.position - b.position)
      .first();

    if (firstChannel) {
      await firstChannel.send({
        embeds: [channelError],
        components: [supportServer],
      });
    } else {
      console.log(
        "Channels in the guild:",
        guild.channels.cache.map(
          (channel) => `${channel.name} (${channel.type})`
        )
      );
      console.log(
        `No suitable channel found to send message in guild ${guild.id}`
      );
    }
  }

  if (!guildSettings.modules.logging.enabled) return;

  if (!guildSettings.modules.logging.loggingChannels.serverChanges) return;

  const logChannel = guild.channels.cache.get(
    guildSettings.modules.logging.loggingChannels.serverChanges
  );

  if (!logChannel) return;

  let channelType;
  switch (channel.type) {
    case 0:
      channelType = 'GUILD_TEXT';
      break;
    case 2:
      channelType = 'GUILD_VOICE';
      break;
    case 4:
      channelType = 'GUILD_CATEGORY';
      break;
    case 5:
      channelType = 'GUILD_ANNOUNCEMENT';
      break;
    case 10:
      channelType = 'ANNOUNCEMENT_THREAD';
      break;
    case 11:
      channelType = 'PUBLIC_THREAD';
      break;
    case 12:
      channelType = 'PRIVATE_THREAD';
      break;
    case 13:
      channelType = 'GUILD_STAGE_VOICE';
      break;
    case 14:
      channelType = 'GUILD_DIRECTORY';
      break;
    case 15:
      channelType = 'GUILD_FORUM';
      break;
    case 16:
      channelType = 'GUILD_MEDIA';
      break;
    default:
      channelType = 'Unknown';
  }

  let fields = [
    {
      name: "Channel:",
      value: `${channel.name} (${channel.id})`,
    },
    {
      name: "Type:",
      value: channelType,
    },
  ];

  const embed = new EmbedBuilder()
    .setColor(guildColours.error)
    .setTitle("Channel Deleted")
    .setDescription("A channel was deleted.")
    .addFields(fields)
    .setTimestamp();

  logChannel.send({ embeds: [embed] });
});

client.on('guildBanAdd', async (guild, user) => {
  try {
    const guildId = guild.id;
    const guildSettings = await getGuildSettings(guildId);
    const guildColours = await require('./database.js').getGuildBotColours(guildId);

    if (!guildSettings) {
      const errorId = uuidv4();
      const errorEmbed = new EmbedBuilder()
        .setColor(guildColours.error)
        .setTitle("Error")
        .setDescription(
          `The guild settings could not be found for ${guild.name} (\`${guild.id}\`).\n\nPlease contact support with the following error ID:\n\`${errorId}\``
        )
        .setTimestamp();

      const errorMessage = `Error ID: ${errorId}, Error Details: Guild settings not found for guild ID ${guild.id}\n`;
      fs.appendFile('errorLog.txt', errorMessage, (err) => {
        if (err) throw err;
      });

      const supportServer = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel("Support Server")
          .setStyle(ButtonStyle.Link)
          .setURL("https://discord.gg/BwD7MgVMuq")
      );

      const firstChannel = guild.channels.cache
        .filter(
          (c) =>
            c.type === ChannelType.GuildText &&
            c.permissionsFor(guild.members.me).has("SendMessages")
        )
        .sort((a, b) => a.position - b.position)
        .first();

      if (firstChannel) {
        await firstChannel.send({
          embeds: [errorEmbed],
          components: [supportServer],
        });
      } else {
        console.log(
          "Channels in the guild:",
          guild.channels.cache.map(
            (channel) => `${channel.name} (${channel.type})`
          )
        );
        console.log(
          `No suitable channel found to send message in guild ${guild.id}`
        );
      }
      return;
    }

    if (!guildSettings.modules.logging.enabled) return;

    if (!guildSettings.modules.logging.loggingChannels.serverChanges) return;

    const logChannel = guild.channels.cache.get(
      guildSettings.modules.logging.loggingChannels.serverChanges
    );

    if (!logChannel) return;

    const embed = new EmbedBuilder()
      .setColor(guildColours.error)
      .setTitle("User Banned")
      .setDescription(`${user.tag} (${user.id}) was banned.`)
      .setTimestamp();

    logChannel.send({ embeds: [embed] });
  } catch (error) {
    console.error("Error in guildBanAdd event:", error);

    const errorId = uuidv4();
    const errorMessage = `Error ID: ${errorId}, Error Details: ${error.stack}\n`;
    fs.appendFile('errorLog.txt', errorMessage, (err) => {
      if (err) throw err;
    });

    // Sending error information to a designated channel (optional)
    const firstChannel = guild.channels.cache
      .filter(
        (c) =>
          c.type === ChannelType.GuildText &&
          c.permissionsFor(guild.members.me).has("SendMessages")
      )
      .sort((a, b) => a.position - b.position)
      .first();

    if (firstChannel) {
      const errorEmbed = new EmbedBuilder()
        .setColor(guildColours.error)
        .setTitle("Error")
        .setDescription(
          `An error occurred while processing the ban for ${user.tag}.\n\nPlease contact support with the following error ID:\n\`${errorId}\``
        )
        .setTimestamp();

      const supportServer = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel("Support Server")
          .setStyle(ButtonStyle.Link)
          .setURL("https://discord.gg/BwD7MgVMuq")
      );

      await firstChannel.send({
        embeds: [errorEmbed],
        components: [supportServer],
      });
    }
  }
});

client.on('guildBanRemove', async (guild, user) => {
  try {
    const guildId = guild.id;
    const guildColours = await require('./database.js').getGuildBotColours(guildId);
    const guildSettings = await getGuildSettings(guildId);

    if (!guildSettings) {
      const errorId = uuidv4();
      const errorEmbed = new EmbedBuilder()
        .setColor(guildColours.error)
        .setTitle("Error")
        .setDescription(
          `The guild settings could not be found for ${guild.name} (\`${guild.id}\`).\n\nPlease contact support with the following error ID:\n\`${errorId}\``
        )
        .setTimestamp();

      const errorMessage = `Error ID: ${errorId}, Error Details: Guild settings not found for guild ID ${guild.id}\n`;
      fs.appendFile('errorLog.txt', errorMessage, (err) => {
        if (err) throw err;
      });

      const supportServer = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel("Support Server")
          .setStyle(ButtonStyle.Link)
          .setURL("https://discord.gg/BwD7MgVMuq")
      );

      const firstChannel = guild.channels.cache
        .filter(
          (c) =>
            c.type === ChannelType.GuildText &&
            c.permissionsFor(guild.members.me).has("SendMessages")
        )
        .sort((a, b) => a.position - b.position)
        .first();

      if (firstChannel) {
        await firstChannel.send({
          embeds: [errorEmbed],
          components: [supportServer],
        });
      } else {
        console.log(
          "Channels in the guild:",
          guild.channels.cache.map(
            (channel) => `${channel.name} (${channel.type})`
          )
        );
        console.log(
          `No suitable channel found to send message in guild ${guild.id}`
        );
      }
      return;
    }

    if (!guildSettings.modules.logging.enabled) return;

    if (!guildSettings.modules.logging.loggingChannels.serverChanges) return;

    const logChannel = guild.channels.cache.get(
      guildSettings.modules.logging.loggingChannels.serverChanges
    );

    if (!logChannel) return;

    const embed = new EmbedBuilder()
      .setColor(guildColours.success)
      .setTitle("User Unbanned")
      .setDescription(`${user.tag} (${user.id}) was unbanned.`)
      .setTimestamp();

    logChannel.send({ embeds: [embed] });
  } catch (error) {
    console.error("Error in guildBanRemove event:", error);

    const errorId = uuidv4();
    const errorMessage = `Error ID: ${errorId}, Error Details: ${error.stack}\n`;
    fs.appendFile('errorLog.txt', errorMessage, (err) => {
      if (err) throw err;
    });

    // Sending error information to a designated channel (optional)
    const firstChannel = guild.channels.cache
      .filter(
        (c) =>
          c.type === ChannelType.GuildText &&
          c.permissionsFor(guild.members.me).has("SendMessages")
      )
      .sort((a, b) => a.position - b.position)
      .first();

    if (firstChannel) {
      const errorEmbed = new EmbedBuilder()
        .setColor(guildColours.error)
        .setTitle("Error")
        .setDescription(
          `An error occurred while processing the unban for ${user.tag}.\n\nPlease contact support with the following error ID:\n\`${errorId}\``
        )
        .setTimestamp();

      const supportServer = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel("Support Server")
          .setStyle(ButtonStyle.Link)
          .setURL("https://discord.gg/BwD7MgVMuq")
      );

      await firstChannel.send({
        embeds: [errorEmbed],
        components: [supportServer],
      });
    }
  }
});

client.on('emojiCreate', async (emoji) => {
  const guild = emoji.guild;
  const guildId = guild.id;
  const guildColours = await require('./database.js').getGuildBotColours(guildId);
  const guildSettings = await getGuildSettings(guildId);

  if (!guildSettings) {
    const errorId = uuidv4();
    const channelError = new EmbedBuilder()
      .setColor(guildColours.error)
      .setTitle("Error")
      .setDescription(
        `The guild settings could not be found for ${guild.name} (\`${guild.id}\`)\n\nPlease contact support with the following error ID\n\`${errorId}\``
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
    );
    const firstChannel = guild.channels.cache
      .filter(
        (c) =>
          c.type === ChannelType.GuildText &&
          c.permissionsFor(guild.members.me).has("SendMessages")
      )
      .sort((a, b) => a.position - b.position)
      .first();

    if (firstChannel) {
      await firstChannel.send({
        embeds: [channelError],
        components: [supportServer],
      });
    } else {
      console.log(
        "Channels in the guild:",
        guild.channels.cache.map(
          (channel) => `${channel.name} (${channel.type})`
        )
      );
      console.log(
        `No suitable channel found to send message in guild ${guild.id}`
      );
    }
  }

  if (!guildSettings.modules.logging.enabled) return;

  if (!guildSettings.modules.logging.loggingChannels.serverChanges) return;

  const logChannel = guild.channels.cache.get(
    guildSettings.modules.logging.loggingChannels.serverChanges
  );

  if (!logChannel) return;

  const embed = new EmbedBuilder()
    .setColor(guildColours.warning)
    .setTitle("Emoji Created")
    .setDescription(`<:${emoji.name}:${emoji.id}> | ${emoji.name} (${emoji.id}) was created.`)
    .setTimestamp();

  logChannel.send({ embeds: [embed] });
});

client.on('emojiDelete', async (emoji) => {
  const guild = emoji.guild;
  const guildId = guild.id;
  const guildColours = await require('./database.js').getGuildBotColours(guildId);
  const guildSettings = await getGuildSettings(guildId);

  if (!guildSettings) {
    const errorId = uuidv4();
    const channelError = new EmbedBuilder()
      .setColor(guildColours.error)
      .setTitle("Error")
      .setDescription(
        `The guild settings could not be found for ${guild.name} (\`${guild.id}\`)\n\nPlease contact support with the following error ID\n\`${errorId}\``
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
    );
    const firstChannel = guild.channels.cache
      .filter(
        (c) =>
          c.type === ChannelType.GuildText &&
          c.permissionsFor(guild.members.me).has("SendMessages")
      )
      .sort((a, b) => a.position - b.position)
      .first();

    if (firstChannel) {
      await firstChannel.send({
        embeds: [channelError],
        components: [supportServer],
      });
    } else {
      console.log(
        "Channels in the guild:",
        guild.channels.cache.map(
          (channel) => `${channel.name} (${channel.type})`
        )
      );
      console.log(
        `No suitable channel found to send message in guild ${guild.id}`
      );
    }
  }

  if (!guildSettings.modules.logging.enabled) return;

  if (!guildSettings.modules.logging.loggingChannels.serverChanges) return;

  const logChannel = guild.channels.cache.get(
    guildSettings.modules.logging.loggingChannels.serverChanges
  );

  if (!logChannel) return;

  const embed = new EmbedBuilder()
    .setColor(guildColours.error)
    .setTitle("Emoji Deleted")
    .setDescription(`${emoji.name} (${emoji.id}) was deleted.`)
    .setTimestamp();

  logChannel.send({ embeds: [embed] });
});

client.on('emojiUpdate', async (oldEmoji, newEmoji) => {
  const guild = newEmoji.guild;
  const guildId = guild.id;
  const guildColours = await require('./database.js').getGuildBotColours(guildId);
  const guildSettings = await getGuildSettings(guildId);

  if (!guildSettings) {
    const errorId = uuidv4();
    const channelError = new EmbedBuilder()
      .setColor(guildColours.error)
      .setTitle("Error")
      .setDescription(
        `The guild settings could not be found for ${guild.name} (\`${guild.id}\`)\n\nPlease contact support with the following error ID\n\`${errorId}\``
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
    );
    const firstChannel = guild.channels.cache
      .filter(
        (c) =>
          c.type === ChannelType.GuildText &&
          c.permissionsFor(guild.members.me).has("SendMessages")
      )
      .sort((a, b) => a.position - b.position)
      .first();

    if (firstChannel) {
      await firstChannel.send({
        embeds: [channelError],
        components: [supportServer],
      });
    } else {
      console.log(
        "Channels in the guild:",
        guild.channels.cache.map(
          (channel) => `${channel.name} (${channel.type})`
        )
      );
      console.log(
        `No suitable channel found to send message in guild ${guild.id}`
      );
    }
  }

  if (!guildSettings.modules.logging.enabled) return;

  if (!guildSettings.modules.logging.loggingChannels.serverChanges) return;

  const logChannel = guild.channels.cache.get(
    guildSettings.modules.logging.loggingChannels.serverChanges
  );

  if (!logChannel) return;

  let fields = [];

  if (oldEmoji.name !== newEmoji.name) {
    fields.push(
      {
        name: "Name:",
        value: `${oldEmoji.name} -> ${newEmoji.name}`
      }
    );
  }

  const embed = new EmbedBuilder()
    .setColor(guildColours.warning)
    .setTitle("Emoji Updated")
    .setDescription(`${oldEmoji.name} (${oldEmoji.id}) was updated.`)
    .addFields(fields)
    .setTimestamp();

  logChannel.send({ embeds: [embed] });
});

client.on('guildMemberUpdate', async (oldMember, newMember) => {
  const guild = newMember.guild;
  const guildId = guild.id;
  const guildColours = await require('./database.js').getGuildBotColours(guildId);
  const guildSettings = await getGuildSettings(guildId);

  if (!guildSettings) {
    const errorId = uuidv4();
    const channelError = new EmbedBuilder()
      .setColor(guildColours.error)
      .setTitle("Error")
      .setDescription(
        `The guild settings could not be found for ${guild.name} (\`${guild.id}\`)\n\nPlease contact support with the following error ID\n\`${errorId}\``
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
    );
    const firstChannel = guild.channels.cache
      .filter(
        (c) =>
          c.type === ChannelType.GuildText &&
          c.permissionsFor(guild.members.me).has("SendMessages")
      )
      .sort((a, b) => a.position - b.position)
      .first();

    if (firstChannel) {
      await firstChannel.send({
        embeds: [channelError],
        components: [supportServer],
      });
    } else {
      console.log(
        "Channels in the guild:",
        guild.channels.cache.map(
          (channel) => `${channel.name} (${channel.type})`
        )
      );
      console.log(
        `No suitable channel found to send message in guild ${guild.id}`
      );
    }
  }

  if (!guildSettings.modules.logging.enabled) return;

  if (!guildSettings.modules.logging.loggingChannels.serverChanges) return;

  const logChannel = guild.channels.cache.get(
    guildSettings.modules.logging.loggingChannels.serverChanges
  );

  if (!logChannel) return;

  let fields = [];

  if (oldMember.nickname !== newMember.nickname) {
    fields.push(
      {
        name: "Nickname:",
        value: `${oldMember.nickname ? oldMember.nickname : "None"} -> ${newMember.nickname ? newMember.nickname : "None"}`
      }
    );
  }

  if (oldMember.roles.cache.size !== newMember.roles.cache.size) {
    let addedRoles = newMember.roles.cache.filter(role => !oldMember.roles.cache.has(role.id));
    let removedRoles = oldMember.roles.cache.filter(role => !newMember.roles.cache.has(role.id));

    if (addedRoles.size > 0) {
      fields.push(
        {
          name: "Added Roles:",
          value: addedRoles.map(role => role.name).join(", ")
        }
      );
    }

    if (removedRoles.size > 0) {
      fields.push(
        {
          name: "Removed Roles:",
          value: removedRoles.map(role => role.name).join(", ")
        }
      );
    }
  }

  if (oldMember.premiumSinceTimestamp !== newMember.premiumSinceTimestamp) {
    fields.push(
      {
        name: "Boosting:",
        value: `${oldMember.premiumSinceTimestamp ? "Boosting" : "Not Boosting"} -> ${newMember.premiumSinceTimestamp ? "Boosting" : "Not Boosting"}`
      }
    );
  }

  if (oldMember.username !== newMember.username) {
    fields.push(
      {
        name: "Username:",
        value: `${oldMember.username} -> ${newMember.username}`
      }
    );
  }

  if (oldMember.nickname !== newMember.nickname) {
    fields.push(
      {
        name: "Nickname:",
        value: `${oldMember.nickname ? oldMember.nickname : "None"} -> ${newMember.nickname ? newMember.nickname : "None"}`
      }
    );
  }

  if (oldMember.avatar !== newMember.avatar) {
    fields.push(
      {
        name: "Avatar:",
        value: `[Old Profile](${oldMember.avatarURL}) -> [New Profile](${newMember.avatarURL})`
      }
    );
  };



  const embed = new EmbedBuilder()
    .setColor(guildColours.warning)
    .setTitle("Member Updated")
    .setDescription(`${newMember.user.tag} (${newMember.id}) was updated.`)
    .addFields(fields)
    .setTimestamp();

  logChannel.send({ embeds: [embed] });
});

// Update uptime regularly
setInterval(() => {
  metrics.uptime = client.uptime;
}, 60000); // Update uptime every minute

// Function to flush metrics before shutdown
async function saveMetricsOnExit() {
  console.log("Saving metrics before shutdown...");
  await flushMetricsToDB();  // Make sure to flush metrics to the DB
  console.log("Metrics saved successfully. Shutting down...");
  process.exit(0);  // Exit the process after saving
}

// Catch SIGINT (Ctrl+C)
process.on('SIGINT', async () => {
  console.log("SIGINT received...");
  await saveMetricsOnExit();
});

// Catch SIGTERM (when process is killed)
process.on('SIGTERM', async () => {
  console.log("SIGTERM received...");
  await saveMetricsOnExit();
});

// Catch unhandled exceptions to prevent crash without saving
process.on('uncaughtException', async (err) => {
  console.error("Uncaught exception:", err);
  await saveMetricsOnExit();
});

// Catch unhandled promise rejections
process.on('unhandledRejection', async (err) => {
  console.error("Unhandled rejection:", err);
  await saveMetricsOnExit();
});

client.once('ready', async () => {

  const status = client.user.setActivity({
    type: ActivityType.Custom,
    name: "customstatus",
    state: "Join the beta program!",
  });

  console.log(`Ready! Logged in as ${client.user.tag}`);

  // Fetch all active giveaways from the database
  //const activeGiveaways = await getAllGiveaways();

  //  if (activeGiveaways.length === 0) return;

  // Schedule a task for each active giveaway
  // for (const giveaway of activeGiveaways) {
  //scheduleGiveawayEnd(giveaway, client);
  // }
});


client.login(process.env.TOKEN);