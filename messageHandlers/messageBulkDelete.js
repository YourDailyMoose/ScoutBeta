const botColours = require("../botColours.json");
const { EmbedBuilder } = require("discord.js");
const { getGuildSettings } = require("../database.js");

async function handleBulkMessageDelete(messages, client) {

    messages = messages.filter(message => !message.author.bot);


    if (messages.size === 0) {
        console.error('No messages found');
        return;
    }

    const guildId = messages.first().guild.id;



    const guildSettings = await getGuildSettings(guildId);

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

    const loggingChannel = messages.first().guild.channels.cache.get(guildSettings.modules.logging.loggingChannels.message);



    if (!loggingChannel) return;

    let deletedMessages = "";
    let embeds = [];

    messages.forEach((message) => {
        let tempMessage = `${message.author.username} (${message.author.id}) - ${message.content}\n`;

        // If the message has any attachments, add them to the message
        if (message.attachments.size > 0) {
            message.attachments.each(attachment => {
                tempMessage += `[Click Here](${attachment.url})\n`;
            });
        }

        if (deletedMessages.length + tempMessage.length > 2048) {
            embeds.push(
                new EmbedBuilder()
                    .setColor(botColours.red)
                    .setTitle("Messages Purged")
                    .setDescription(deletedMessages)
                    .addFields(
                        {
                            name: "Channel:",
                            value: `${message.channel.name} (${message.channel.id})`,
                        },
                        { name: "Message Count:", value: `${messages.size}` } // convert number to string
                    )
                    .setTimestamp()
            );

            deletedMessages = tempMessage; // start new string for next embed
        } else {
            deletedMessages += tempMessage;
        }
    });

    // add remaining messages to final embed
    embeds.push(
        new EmbedBuilder()
            .setColor(botColours.red)
            .setTitle("Messages Purged")
            .setDescription(deletedMessages)
            .addFields(
                {
                    name: "Channel:",
                    value: `<#${messages.first().channel.id}> (${messages.first().channel.id})`,
                },
                { name: "Message Count:", value: `${messages.size}` } // convert number to string
            )
            .setTimestamp()
    );

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