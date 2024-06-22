const { SlashCommandBuilder, ActionRowBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle } = require('discord.js')


const quotes = [
    {
        "quote": "Success is not final, failure is not fatal: It is the courage to continue that counts.",
        "author": "Winston Churchill"
    },
    {
        "quote": "Your time is limited, don't waste it living someone else's life.",
        "author": "Steve Jobs"
    },
    {
        "quote": "The only way to do great work is to love what you do.",
        "author": "Steve Jobs"
    },
    {
        "quote": "Believe you can and you're halfway there.",
        "author": "Theodore Roosevelt"
    },
    {
        "quote": "Life is what happens when you're busy making other plans.",
        "author": "John Lennon"
    },
    {
        "quote": "The future belongs to those who believe in the beauty of their dreams.",
        "author": "Eleanor Roosevelt"
    },
    {
        "quote": "Strive not to be a success, but rather to be of value.",
        "author": "Albert Einstein"
    },
    {
        "quote": "In the end, it's not the years in your life that count. It's the life in your years.",
        "author": ""
    },
    {
        "quote": "You miss 100% of the shots you don't take.",
        "author": "Wayne Gretzky"
    },
    {
        "quote": "The only limit to our realization of tomorrow will be our doubts of today.",
        "author": "Franklin D. Roosevelt"
    },
    {
        "quote": "The greatest glory in living lies not in never falling, but in rising every time we fall.",
        "author": "Nelson Mandela"
    },
    {
        "quote": "It does not matter how slowly you go as long as you do not stop.",
        "author": "Confucius"
    },
    {
        "quote": "Life is either a daring adventure or nothing at all.",
        "author": "Helen Keller"
    },
    {
        "quote": "The only thing necessary for the triumph of evil is for good men to do nothing.",
        "author": ""
    },
    {
        "quote": "Keep your face always toward the sunshine - and shadows will fall behind you.",
        "author": "Walt Whitman"
    },
    {
        "quote": "The best way to predict the future is to create it.",
        "author": ""
    },
    {
        "quote": "The only true wisdom is in knowing you know nothing.",
        "author": "Socrates"
    },
    {
        "quote": "Life is 10% what happens to us and 90% how we react to it.",
        "author": "Charles R. Swindoll"
    },
    {
        "quote": "The only thing we have to fear is fear itself.",
        "author": "Franklin D. Roosevelt"
    },
    {
        "quote": "It's not whether you get knocked down, it's whether you get up.",
        "author": "Vince Lombardi"
    },
    {
        "quote": "The greatest glory in living lies not in never falling, but in rising every time we fall.",
        "author": "Nelson Mandela"
    },
    {
        "quote": "Life is like riding a bicycle. To keep your balance, you must keep moving.",
        "author": "Albert Einstein"
    },
    {
        "quote": "Nothing is impossible, the word itself says 'I'm possible'!",
        "author": "Audrey Hepburn"
    },
    {
        "quote": "Do not go where the path may lead, go instead where there is no path and leave a trail.",
        "author": "Ralph Waldo Emerson"
    },
    {
        "quote": "The only thing worse than being blind is having sight but no vision.",
        "author": "Helen Keller"
    },
    {
        "quote": "Twenty years from now you will be more disappointed by the things that you didn’t do than by the ones you did do.",
        "author": "Mark Twain"
    },
    {
        "quote": "The journey of a thousand miles begins with one step.",
        "author": "Lao Tzu"
    },
    {
        "quote": "The only place where success comes before work is in the dictionary.",
        "author": "Vidal Sassoon"
    },
    {
        "quote": "Every strike brings me closer to the next home run.",
        "author": "Babe Ruth"
    },
    {
        "quote": "The mind is everything. What you think you become.",
        "author": "Buddha"
    },
    {
        "quote": "Whatever you can do, or dream you can, begin it. Boldness has genius, power, and magic in it.",
        "author": "Johann Wolfgang von Goethe"
    },
    {
        "quote": "If you want to lift yourself up, lift up someone else.",
        "author": "Booker T. Washington"
    },
    {
        "quote": "The best revenge is massive success.",
        "author": "Frank Sinatra"
    },
    {
        "quote": "Believe you can and you're halfway there.",
        "author": "Theodore Roosevelt"
    },
    {
        "quote": "The only thing necessary for the triumph of evil is for good men to do nothing.",
        "author": ""
    },
    {
        "quote": "I've learned that people will forget what you said, people will forget what you did, but people will never forget how you made them feel.",
        "author": "Maya Angelou"
    },
    {
        "quote": "The only impossible journey is the one you never begin.",
        "author": "Tony Robbins"
    },
    {
        "quote": "It's not the years in your life that count. It's the life in your years.",
        "author": ""
    },
    {
        "quote": "Life is what happens when you're busy making other plans.",
        "author": "John Lennon"
    },
    {
        "quote": "You miss 100% of the shots you don't take.",
        "author": "Wayne Gretzky"
    },
    {
        "quote": "The only limit to our realization of tomorrow will be our doubts of today.",
        "author": "Franklin D. Roosevelt"
    },
    {
        "quote": "Don't watch the clock; do what it does. Keep going.",
        "author": "Sam Levenson"
    },
    {
        "quote": "The only true wisdom is in knowing you know nothing.",
        "author": "Socrates"
    },
    {
        "quote": "In the end, it's not the years in your life that count. It's the life in your years.",
        "author": ""
    },
    {
        "quote": "The best way to predict the future is to create it.",
        "author": ""
    },
    {
        "quote": "Life is 10% what happens to us and 90% how we react to it.",
        "author": "Charles R. Swindoll"
    },
    {
        "quote": "It's not whether you get knocked down, it's whether you get up.",
        "author": "Vince Lombardi"
    },
    {
        "quote": "Nothing is impossible, the word itself says 'I'm possible'!",
        "author": "Audrey Hepburn"
    },
    {
        "quote": "The only thing worse than being blind is having sight but no vision.",
        "author": "Helen Keller"
    },
    {
        "quote": "Twenty years from now you will be more disappointed by the things that you didn’t do than by the ones you did do.",
        "author": "Mark Twain"
    },
    {
        "quote": "The journey of a thousand miles begins with one step.",
        "author": "Lao Tzu"
    },
    {
        "quote": "The only place where success comes before work is in the dictionary.",
        "author": "Vidal Sassoon"
    },
    {
        "quote": "Every strike brings me closer to the next home run.",
        "author": "Babe Ruth"
    },
    {
        "quote": "The mind is everything. What you think you become.",
        "author": "Buddha"
    },
    {
        "quote": "Whatever you can do, or dream you can, begin it. Boldness has genius, power, and magic in it.",
        "author": "Johann Wolfgang von Goethe"
    },
    {
        "quote": "If you want to lift yourself up, lift up someone else.",
        "author": "Booker T. Washington"
    },
    {
        "quote": "The best revenge is massive success.",
        "author": "Frank Sinatra"
    },
    {
        "quote": "Believe you can and you're halfway there.",
        "author": "Theodore Roosevelt"
    },
    {
        "quote": "The only thing necessary for the triumph of evil is for good men to do nothing.",
        "author": ""
    },
    {
        "quote": "I've learned that people will forget what you said, people will forget what you did, but people will never forget how you made them feel.",
        "author": "Maya Angelou"
    },
    {
        "quote": "The only impossible journey is the one you never begin.",
        "author": "Tony Robbins"
    },
    {
        "quote": "It's not the years in your life that count. It's the life in your years.",
        "author": ""
    },
    {
        "quote": "Life is what happens when you're busy making other plans.",
        "author": "John Lennon"
    },
    {
        "quote": "You miss 100% of the shots you don't take.",
        "author": "Wayne Gretzky"
    },
    {
        "quote": "The only limit to our realization of tomorrow will be our doubts of today.",
        "author": "Franklin D. Roosevelt"
    },
    {
        "quote": "Don't watch the clock; do what it does. Keep going.",
        "author": "Sam Levenson"
    },
    {
        "quote": "The only true wisdom is in knowing you know nothing.",
        "author": "Socrates"
    },
    {
        "quote": "In the end, it's not the years in your life that count. It's the life in your years.",
        "author": ""
    },
    {
        "quote": "The best way to predict the future is to create it.",
        "author": ""
    },
    {
        "quote": "Life is 10% what happens to us and 90% how we react to it.",
        "author": "Charles R. Swindoll"
    },
    {
        "quote": "It's not whether you get knocked down, it's whether you get up.",
        "author": "Vince Lombardi"
    },
    {
        "quote": "Nothing is impossible, the word itself says 'I'm possible'!",
        "author": "Audrey Hepburn"
    },
    {
        "quote": "The only thing worse than being blind is having sight but no vision.",
        "author": "Helen Keller"
    },
    {
        "quote": "Twenty years from now you will be more disappointed by the things that you didn’t do than by the ones you did do.",
        "author": "Mark Twain"
    },
    {
        "quote": "The journey of a thousand miles begins with one step.",
        "author": "Lao Tzu"
    },
    {
        "quote": "The only place where success comes before work is in the dictionary.",
        "author": "Vidal Sassoon"
    },
    {
        "quote": "Every strike brings me closer to the next home run.",
        "author": "Babe Ruth"
    },
    {
        "quote": "The mind is everything. What you think you become.",
        "author": "Buddha"
    },
    {
        "quote": "Whatever you can do, or dream you can, begin it. Boldness has genius, power, and magic in it.",
        "author": "Johann Wolfgang von Goethe"
    },
    {
        "quote": "If you want to lift yourself up, lift up someone else.",
        "author": "Booker T. Washington"
    },
    {
        "quote": "The best revenge is massive success.",
        "author": "Frank Sinatra"
    },
    {
        "quote": "yes",
        "author": "raiden"
    }

]

module.exports = {
    cooldown: 5,
    data: new SlashCommandBuilder()
        .setName('quote')
        .setDescription('Get a famous or inspirational quote'),
    async execute(interaction) {

        const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];

        // Check if randomQuote is defined and has necessary properties
        if (!randomQuote || !randomQuote.quote) {
            console.error('randomQuote or randomQuote.quote is undefined');
            return;
        }

        // Create an embed message
        const embed = new EmbedBuilder()
            .setColor(guildColours.special)
            .setTitle('Random Quote')
            .setDescription(`\"${randomQuote.quote}\" - ${randomQuote.author ? randomQuote.author : 'Unknown'}`);

        // Send the embed to the channel
        interaction.reply({ embeds: [embed] });
    }
}

