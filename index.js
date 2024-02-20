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

const { connectDatabase, onInvite, wipeGuildSettings } = require("./database");

const {
  connectBlacklistDatabase,
  isUserBlacklisted,
} = require("./blacklistDatabase.js");
const dotenv = require("dotenv");
const { getGuildSettings } = require("./database.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildModeration,
  ],
  partials: ["MESSAGE", "CHANNEL", "REACTION"],
});

dotenv.config();

client.commands = new Collection();

const foldersPath = path.join(__dirname, "commands");
const commandFolders = fs.readdirSync(foldersPath);

const botColours = {
  primary: "#69dc9e",
  green: "#bcf7cb",
  gray: "#2f3136",
  red: "#f6786a",
  amber: "#f8c57c",
  purple: "#966FD6",
};

module.exports.botColours = botColours;

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

client.on("guildCreate", async (guild) => {
  const embed = new EmbedBuilder()
    .setColor(botColours.primary) // Make sure botColours.green is defined
    .setTitle(`Welcome to Scout!`)
    .setDescription(`Thank you for inviting Scout Beta to your server!`)
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
    fs.appendFile("errorLog.txt", errorMessage, (err) => {
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
      },
      {
        name: "Message:",
        value: message.content.length ? message.content : "None",
      }
    )
    .setTimestamp();

  loggingChannel.send({ embeds: [embed] });
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
