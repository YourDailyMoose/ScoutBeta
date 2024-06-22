const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  cooldown: 10,
  data: new SlashCommandBuilder()
    .setName('randomcolor')
    .setDescription('Generates a random color and6 displays it in an embed.'),

  async execute(interaction) {
    const guildColours = await require('../../database').getGuildBotColours(interaction.guild.id)
    // Make sure fetch is imported
    // Generate a random color
    const r = Math.floor(Math.random() * 256);
    const g = Math.floor(Math.random() * 256);
    const b = Math.floor(Math.random() * 256);

    // Convert to HEX
    const hex = '#' + ((r << 16) + (g << 8) + b).toString(16).padStart(6, '0');

    // Convert to RGB
    const rgb = `${r}, ${g}, ${b}`;

    // Convert to HSL
    const hsl = rgbToHsl(r, g, b);

    // Convert to CMYK
    const cmyk = rgbToCmyk(r, g, b);

    function rgbToHsl(r, g, b) {
      r /= 255, g /= 255, b /= 255;
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      let h, s, l = (max + min) / 2;

      if (max === min) {
        h = s = 0; // achromatic
      } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
          case r: h = (g - b) / d + (g < b ? 6 : 0); break;
          case g: h = (b - r) / d + 2; break;
          case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
      }

      return `${Math.round(h * 360)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%`;
    }

    function rgbToCmyk(r, g, b) {
      r = r / 255;
      g = g / 255;
      b = b / 255;
      const k = Math.min(1 - r, 1 - g, 1 - b);
      const c = (1 - r - k) / (1 - k) || 0;
      const m = (1 - g - k) / (1 - k) || 0;
      const y = (1 - b - k) / (1 - k) || 0;
      return `${Math.round(c * 100)}%, ${Math.round(m * 100)}%, ${Math.round(y * 100)}%, ${Math.round(k * 100)}%`;
    }

    // Generate an image URL using a placeholder service
    const imageUrl = `https://www.colorhexa.com/${hex.slice(1)}.png`;

    // Create an embed
    const embed = new EmbedBuilder()
      .setColor(hex)
      .setTitle('Random Color')
      .setDescription(`**Hex**: ${hex}\n**RGB**: ${r}, ${g}, ${b}\n**HSL**: ${hsl}\n**CMYK**: ${cmyk}`)
      .setThumbnail(imageUrl);

    // Send the embed
    await interaction.reply({ embeds: [embed] });
  },
};