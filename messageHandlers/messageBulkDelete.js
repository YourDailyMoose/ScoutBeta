const { EmbedBuilder } = require("discord.js");
const { getGuildSettings, getGuildBotColours } = require("../database.js");

async function handleBulkMessageDelete(messages, client) {

    const guildColours = getGuildBotColours(message.guild.id)

    messages = messages.filter(message => !message.author.bot);


    if (messages.size === 0) {
        return;
    }

    const guildId = messages.first().guild.id;



    const guildSettings = await getGuildSettings(guildId);

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

    const loggingChannel = messages.first().guild.channels.cache.get(guildSettings.modules.logging.loggingChannels.message);



    if (!loggingChannel) return;


    let deletedMessages = '';
    let embeds = [];
    let currentEmbed = new EmbedBuilder()
        .setColor(guildColours.error)
        .setTitle("Messages Purged");

    let messageCount = 0;

    messages.forEach((message, index) => {
        const tempMessage = `${message.author.tag} (${message.author.id}): ${message.content}\n`;

        // If the current embed has 20 messages, create a new embed
        if (messageCount >= 20) {
            embeds.push(currentEmbed);

            deletedMessages = tempMessage;
            messageCount = 1; // Reset message count for the new embed

            currentEmbed = new EmbedBuilder()
                .setColor(guildColours.error)
                .setTitle("Messages Purged");
        } else {
            deletedMessages += tempMessage;
            messageCount++;
        }

        // Add the messages to the current embed
        currentEmbed.setDescription(deletedMessages);
    });

    // Add the info to the last embed
    currentEmbed.addFields(
        {
            name: "Channel:",
            value: `<#${messages.first().channel.id}> (${messages.first().channel.id})`,
        },
        { name: "Message Count:", value: `${messages.size}` } // convert number to string
    );
    embeds.push(currentEmbed);

    // get the channel from the mapping
    const channel = client.channels.cache.get(loggingChannel.id);

    // send all embeds
    if (!channel) {
        console.error(`Logging channel with ID ${loggingChannel} not found`);
    } else {
        // send all embeds
        embeds.forEach((embed) => channel.send({ embeds: [embed] }));
    }

}

module.exports = { handleBulkMessageDelete };