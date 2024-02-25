const fs = require("node:fs");
const path = require("node:path");
const {
  Client,
  Collection,
  Events,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ChannelType,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  SelectMenuBuilder,
  PermissionsBitField,
  ActivityType,
} = require("discord.js");
const {
  connectDatabase,
  setupServerdata,
  wipeGuildSettings,
  getGuildSettings,
} = require("./database");
const {
  handleBulkMessageDelete
} = require("./messageHandlers/messageBulkDelete.js");
const {
  connectBlacklistDatabase,
  isUserBlacklisted,
} = require("./blacklistDatabase.js");
const { handleExperienceGain } = require("./leveingSystem/handleLeveling.js");
const dotenv = require("dotenv");
const { v4: uuidv4 } = require("uuid");
const botColours = require('./botColours.json')

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildVoiceStates
  ],
  partials: ["MESSAGE", "CHANNEL", "REACTION"],
});

dotenv.config();

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

    if ("data" in command && "execute" in command) {
      client.commands.set(command.data.name, command);
    } else {
      console.log(
        `[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`
      );
    }
  }
}

//Database Setup

const mongoURI = process.env.MONGODB_URI;
const blacklistDBuri = process.env.BLACKLIST_DB_URI;

connectDatabase(mongoURI)
  .then(() => {
    console.log("Connected to Scout Database");
  })
  .catch((err) => {
    console.error("Failed to connect to MongoDB", err);
  });

connectBlacklistDatabase(blacklistDBuri)
  .then(() => {
    console.log("Connected to Blacklist Database");
  })
  .catch((err) => {
    console.error("Failed to connect to MongoDB", err);
  });

//Events

client.on("interactionCreate", async (interaction) => {
  // Check if the user is blacklisted
  const userId = interaction.user.id;
  const blacklistedUser = await isUserBlacklisted(userId);

  if (blacklistedUser) {
    const blacklistedEmbed = new EmbedBuilder()
      .setColor(botColours.red)
      .setTitle(`You have been blacklisted from Scout.`)
      .addFields(
        { name: "Reason:", value: blacklistedUser.Reason },
        { name: "Timestamp:", value: blacklistedUser.DateTime }
      )
      .setTimestamp()
      .setFooter({
        text: `To appeal, please join our Support Server and create a ticket`,
      });

    const supportServerButton = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel("Support Server")
        .setStyle("Link")
        .setURL("https://discord.gg/BwD7MgVMuq")
    );

    return interaction.reply({
      embeds: [blacklistedEmbed],
      components: [supportServerButton],
    });
  }




  if (interaction.isCommand()) {
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
  }
});

client.on("messageCreate", async (message) => {
  handleExperienceGain(message);
});

client.on("messageDeleteBulk", async (messages) => {

  handleBulkMessageDelete(messages, client);
});

client.on("guildCreate", async (guild) => {

  const isUserBlacklisted = await isUserBlacklisted(guild.ownerId);

  if (isUserBlacklisted) {

    const embed = new EmbedBuilder()
      .setColor(botColours.red)
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
    .setColor(botColours.green) // Make sure botColours.green is defined
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
    .setColor(botColours.red)
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

  if (!guildSettings) {
    const errorId = uuidv4();
    const channelError = new EmbedBuilder()
      .setColor(botColours.red)
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
        .setColor(botColours.amber)
        .setTimestamp();
    } else {
      const channel = action === 'joined' ? newChannel : oldChannel;
      embed = new EmbedBuilder()
        .setTitle('Voice Channel Update')
        .setDescription(`${newState.member} has ${action} the voice channel ${channel}.`)
        .setColor(botColours.amber)
        .setTimestamp();
    }

    logChannel.send({ embeds: [embed] });
  }
});

client.on("messageUpdate", async (oldMessage, newMessage) => {

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
      .setColor(botColours.red)
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
    .setColor(botColours.amber)
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
  const guildSettings = await getGuildSettings(guildId);

  const welcomeMessages = guildSettings.modules.welcomeMessages;

  if (!guildSettings) {
    const errorId = uuidv4();
    const channelError = new EmbedBuilder()
      .setColor(botColours.red)
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
      .setColor(botColours.red)
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

  const leaveMessages = guildSettings.modules.leaveMessages;

  if (!guildSettings) {
    const errorId = uuidv4();
    const channelError = new EmbedBuilder()
      .setColor(botColours.red)
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
      .setColor(botColours.red)
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


client.once(Events.ClientReady, (c) => {
  const status = client.user.setActivity({
    type: ActivityType.Custom,
    name: "customstatus",
    state: "Join the beta program!",
  });

  console.log(`Ready! Logged in as ${c.user.tag}`);
});

client.login(process.env.TOKEN);
