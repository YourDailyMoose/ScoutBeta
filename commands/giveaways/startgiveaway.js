const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ChannelType, ActionRowBuilder } = require('discord.js');

const { registerGiveaway } = require('../../database.js')

module.exports = {
    data: new SlashCommandBuilder()
        .setName('startgiveaway')
        .setDescription('Start a giveaway')
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('The channel to start the giveaway in')
                .addChannelTypes(ChannelType.GuildAnnouncement, ChannelType.GuildText)
                .setRequired(true))
        .addStringOption(option =>
            option.setName('prize')
                .setDescription('The prize for the giveaway')
                .setRequired(true)
                .setMaxLength(500))
        .addIntegerOption(option =>
            option.setName('winners')
                .setDescription('The number of winners for the giveaway')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(10))
        .addStringOption(option =>
            option.setName('duration')
                .setDescription('The duration of the giveaway (e.g. "1d, 6h 2m, 8s")')
                .setRequired(true)),

    async execute(interaction) {
        const prize = interaction.options.getString('prize');
        const winners = interaction.options.getInteger('winners');
        const durationStr = interaction.options.getString('duration');
        const channel = interaction.options.getChannel('channel');
        const guildId = interaction.guild.id;
        const channelId = channel.id

        // Parse the duration string
        const duration = parseDuration(durationStr);

        const endTime = new Date(Date.now() + duration * 60 * 1000);

        const embed = new EmbedBuilder()
            .setTitle('Giveaway')
            .setDescription(`Prize: **${prize}**\nWinners: **${winners}**\nHosted by: ${interaction.user}`)
            .setColor(guildColours.special)
            .setFooter({ text: 'Ends at' })
            .setTimestamp(endTime);

        const button = new ButtonBuilder()
            .setLabel('Enter')
            .setEmoji('🎉')
            .setStyle('Primary')
            .setCustomId('enter_giveaway');

        const row = new ActionRowBuilder()
            .addComponents(button);

        const message = await interaction.options.getChannel('channel').send({ embeds: [embed], components: [row] });

        await registerGiveaway(guildId, channelId, message.id, prize, winners, duration, Date.now());


        const createdEmbed = new EmbedBuilder()
            .setTitle('Giveaway Created')
            .setDescription(`**Prize:** ${prize}\n**Winners:** ${winners}\n**Duration** ${durationStr}\n**Channel:** <#${channel.id}>`)
            .setColor(botColours.green)
            .setFooter({ text: `Message ID: ${message.id}`});

        interaction.reply({ embeds: [createdEmbed], ephemeral: true });
    }
};

function parseDuration(str) {
    const units = {
        d: 60 * 24,
        h: 60,
        m: 1,
        s: 1 / 60
    };

    return str.split(' ').reduce((total, chunk) => {
        const unit = chunk.slice(-1);
        const value = parseInt(chunk.slice(0, -1));
        return total + (value * units[unit]);
    }, 0);
}