const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    cooldown: 8,
    data: new SlashCommandBuilder()
        .setName('purge')
        .setDescription('Purge messages based on specific criteria.')
        .setDMPermission(false)
        .addSubcommand(subcommand =>
            subcommand
                .setName('all')
                .setDescription('Purge all messages.')
                .addIntegerOption(option =>
                    option.setName('amount')
                        .setDescription('Number of messages to purge')
                        .setMinValue(1)
                        .setMaxValue(100)
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('users')
                .setDescription('Purge messages sent by specific users.')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('User whose messages to purge')
                        .setRequired(true))
                .addIntegerOption(option =>
                    option.setName('amount')
                        .setDescription('Number of messages to purge')
                        .setMinValue(1)
                        .setMaxValue(100)
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('text')
                .setDescription('Purge messages containing specific text.')
                .addStringOption(option =>
                    option.setName('text')
                        .setDescription('Text to match in messages')
                        .setRequired(true))
                .addIntegerOption(option =>
                    option.setName('amount')
                        .setDescription('Number of messages to purge')
                        .setMinValue(1)
                        .setMaxValue(100)
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('startswith')
                .setDescription('Purge messages that start with specific text.')
                .addStringOption(option =>
                    option.setName('text')
                        .setDescription('Text that messages start with')
                        .setRequired(true))
                .addIntegerOption(option =>
                    option.setName('amount')
                        .setDescription('Number of messages to purge')
                        .setMinValue(1)
                        .setMaxValue(100)
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('notcontaining')
                .setDescription('Purge messages that do not contain specific text.')
                .addStringOption(option =>
                    option.setName('text')
                        .setDescription('Text that messages should not contain')
                        .setRequired(true))
                .addIntegerOption(option =>
                    option.setName('amount')
                        .setDescription('Number of messages to purge')
                        .setMinValue(1)
                        .setMaxValue(100)
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('mentions')
                .setDescription('Purge messages that contain mentions.')
                .addIntegerOption(option =>
                    option.setName('amount')
                        .setDescription('Number of messages to purge')
                        .setMinValue(1)
                        .setMaxValue(100)
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('matches')
                .setDescription('Purge messages that match specific text exactly.')
                .addStringOption(option =>
                    option.setName('text')
                        .setDescription('Exact text to match in messages')
                        .setRequired(true))
                .addIntegerOption(option =>
                    option.setName('amount')
                        .setDescription('Number of messages to purge')
                        .setMinValue(1)
                        .setMaxValue(100)
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('links')
                .setDescription('Purge messages containing links.')
                .addIntegerOption(option =>
                    option.setName('amount')
                        .setDescription('Number of messages to purge')
                        .setMinValue(1)
                        .setMaxValue(100)
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('invites')
                .setDescription('Purge messages containing invites.')
                .addIntegerOption(option =>
                    option.setName('amount')
                        .setDescription('Number of messages to purge')
                        .setMinValue(1)
                        .setMaxValue(100)
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('images')
                .setDescription('Purge messages containing images.')
                .addIntegerOption(option =>
                    option.setName('amount')
                        .setDescription('Number of messages to purge')
                        .setMinValue(1)
                        .setMaxValue(100)
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('endswith')
                .setDescription('Purge messages that end with specific text.')
                .addStringOption(option =>
                    option.setName('text')
                        .setDescription('Text that messages end with')
                        .setRequired(true))
                .addIntegerOption(option =>
                    option.setName('amount')
                        .setDescription('Number of messages to purge')
                        .setMinValue(1)
                        .setMaxValue(100)
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('embeds')
                .setDescription('Purge messages containing embeds.')
                .addIntegerOption(option =>
                    option.setName('amount')
                        .setDescription('Number of messages to purge')
                        .setMinValue(1)
                        .setMaxValue(100)
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('bots')
                .setDescription('Purge messages sent by bots.')
                .addIntegerOption(option =>
                    option.setName('amount')
                        .setDescription('Number of messages to purge')
                        .setMinValue(1)
                        .setMaxValue(100)
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('any')
                .setDescription('Purge any type of messages.')
                .addIntegerOption(option =>
                    option.setName('amount')
                        .setDescription('Number of messages to purge')
                        .setMinValue(1)
                        .setMaxValue(100)
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('after')
                .setDescription('Purge messages after a certain message ID.')
                .addStringOption(option =>
                    option.setName('message_id')
                        .setDescription('Message ID to start purging after')
                        .setRequired(true))
                .addIntegerOption(option =>
                    option.setName('amount')
                        .setDescription('Number of messages to purge')
                        .setMinValue(1)
                        .setMaxValue(100)
                        .setRequired(true))),
    permission: ['adminRoles', 'godRoles'],
    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const amount = interaction.options.getInteger('amount');
        const text = interaction.options.getString('text');
        const user = interaction.options.getUser('user');
        const messageId = interaction.options.getString('message_id');

        try {
            await interaction.reply({ content: 'Purging...', ephemeral: true });

            let messages;
            switch (subcommand) {
                case 'all':
                    messages = await interaction.channel.messages.fetch({ limit: amount });
                    break;
                case 'users':
                    messages = (await interaction.channel.messages.fetch({ limit: amount }))
                        .filter(msg => msg.author.id === user.id);
                    break;
                case 'text':
                    messages = (await interaction.channel.messages.fetch({ limit: amount }))
                        .filter(msg => msg.content.includes(text));
                    break;
                case 'startswith':
                    messages = (await interaction.channel.messages.fetch({ limit: amount }))
                        .filter(msg => msg.content.startsWith(text));
                    break;
                case 'notcontaining':
                    messages = (await interaction.channel.messages.fetch({ limit: amount }))
                        .filter(msg => !msg.content.includes(text));
                    break;
                case 'mentions':
                    messages = (await interaction.channel.messages.fetch({ limit: amount }))
                        .filter(msg => msg.mentions.users.size > 0 || msg.mentions.roles.size > 0);
                    break;
                case 'matches':
                    messages = (await interaction.channel.messages.fetch({ limit: amount }))
                        .filter(msg => msg.content === text);
                    break;
                case 'links':
                    const linkRegex = /(https?:\/\/[^\s]+)/g;
                    messages = (await interaction.channel.messages.fetch({ limit: amount }))
                        .filter(msg => linkRegex.test(msg.content));
                    break;
                case 'invites':
                    const inviteRegex = /(https?:\/\/)?(www\.)?(discord\.(gg|io|me|li)|discordapp\.com\/invite)\/[a-zA-Z0-9]+/g;
                    messages = (await interaction.channel.messages.fetch({ limit: amount }))
                        .filter(msg => inviteRegex.test(msg.content));
                    break;
                case 'images':
                    messages = (await interaction.channel.messages.fetch({ limit: amount }))
                        .filter(msg => msg.attachments.size > 0 && msg.attachments.every(att => att.contentType.startsWith('image/')));
                    break;
                case 'endswith':
                    messages = (await interaction.channel.messages.fetch({ limit: amount }))
                        .filter(msg => msg.content.endsWith(text));
                    break;
                case 'embeds':
                    messages = (await interaction.channel.messages.fetch({ limit: amount }))
                        .filter(msg => msg.embeds.length > 0);
                    break;
                case 'bots':
                    messages = (await interaction.channel.messages.fetch({ limit: amount }))
                        .filter(msg => msg.author.bot);
                    break;
                case 'any':
                    messages = await interaction.channel.messages.fetch({ limit: amount });
                    break;
                case 'after':
                    messages = (await interaction.channel.messages.fetch({ limit: 100 })).filter(msg => msg.id > messageId).slice(0, amount);
                    break;
                default:
                    throw new Error('Unknown subcommand');
            }

            const deletedMessages = await interaction.channel.bulkDelete(messages, true);
            await interaction.editReply({ content: `Successfully purged \`${deletedMessages.size}\` messages.`, ephemeral: true });
        } catch (error) {
            console.error(error);
            await interaction.editReply({ content: 'There was an error purging messages in this channel!', ephemeral: true });
        }
    },
};