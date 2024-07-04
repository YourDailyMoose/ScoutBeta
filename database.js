const { MongoClient, ServerApiVersion, ObjectId, Long } = require('mongodb');
const { DateTime } = require('luxon');
const { v4: uuidv4 } = require('uuid');

let db;

// Path to your certificate
const credentials = './mongoCert/X509-cert-6949459650898832615.pem';

// MongoDB connection 
const client = new MongoClient('mongodb+srv://scout.792kxhq.mongodb.net/?authSource=%24external&authMechanism=MONGODB-X509&retryWrites=true&w=majority&appName=Scout', {
  tlsCertificateKeyFile: credentials,
  serverApi: ServerApiVersion.v1,
});

async function connectToDatabase() {
  try {
    await client.connect();
    db = client.db('botData');

    // Registering the close event listener
    client.on('close', () => {
      console.log('MongoDB connection closed');
    });
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
  }
}

function getDB() {
  return db;
}

async function setupServerdata(guildId) {
  // Assume 'db' is your database connection. Ensure it's properly initialized.
  const existingGuildData = await db.collection('botSettings').findOne({ _id: guildId });

  // If no document was found for the guild, insert new default settings
  if (!existingGuildData) {
    const guildData = {
      "_id": {
        "$numberLong": guildId
      },
      "serverSettings": {
        "colours": {
          "primary": "#69dc9e",
          "success": "#bcf7cb",
          "error": "#f6786a",
          "warning": "#f8c57c",
          "special": "#966FD6"
        },
        "timezone": "Australia/Sydney",
        "nickname": ""
      },
      "moderationSettings": {
        "requireReason": false,
        "permissionHierarchy": true,
        "punishmentDM": {
          "sendDM": false,
          "stateReason": true,
          "stateModerator": false
        }
      },
      "rolePermissions": {
        "godRoles": [],
        "adminRoles": [],
        "banRoles": [],
        "kickRoles": [],
        "muteRoles": [],
        "warnRoles": []
      },
      "modules": {
        "welcomeMessages": {
          "enabled": false,
          "channelId": null,
          "message": {
            "embed": {
              "enabled": false,
              "title": "Welcome to the server!",
              "description": "Thanks for joining the server, <user>!",
              "thumbnail": {
                "enabled": false,
                "profilePicture": true,
                "serverIcon": false,
                "url": ""
              },
              "color": 11566958
            },
            "text": {
              "enabled": true,
              "content": "Welcome to the server <user>!"
            }
          }
        },
        "leaveMessages": {
          "enabled": false,
          "channelId": null,
          "message": {
            "embed": {
              "enabled": false,
              "title": "Goodbye!",
              "description": "Goodbye, <user>!",
              "thumbnail": {
                "enabled": false,
                "profilePicture": true,
                "serverIcon": false,
                "url": ""
              },
              "color": 11566958
            },
            "text": {
              "enabled": true,
              "content": "Goodbye <user>!"
            }
          }
        },
        "moderation": {
          "enabled": true
        },
        "fun": {
          "enabled": true
        },
        "utility": {
          "enabled": true
        },
        "levels": {
          "enabled": false,
          "levelRoles": [],
          "levelMessages": []
        },
        "logging": {
          "enabled": false,
          "loggingChannels": {
            "moderation": null,
            "joinLeave": null,
            "message": null,
            "voice": null,
            "memberChanges": null,
            "serverChanges": null
          }
        }
      },
      "disabledCommands": []

    }

    const levelData = {
      "_id": Long.fromString(guildId),
      "levels": {}
    }

    try {
      await db.collection('botSettings').insertOne(guildData);

      await db.collection('guildLevels').insertOne(levelData);
      return;

    } catch (error) {
      console.error(`Error adding guild ${guildId} to the database:`, error);
      throw error; // Throw the error to be handled by the caller
    }
  }
}


async function wipeGuildSettings(guildId) {
  try {
    await db.collection('botSettings').deleteOne({ _id: guildId });
    return (true)
  } catch (error) {
    console.error(`Error deleting guild ${guildId} from the database:`, error);
    return (false)
  }
}



async function getGuildSettings(guildId) {
  if (!guildId) {
    console.error('Error: guildId is undefined');
    return;
  }

  const longGuildId = Long.fromString(guildId);
  return await db.collection('botSettings').findOne({ _id: longGuildId });
}

async function logPunishment(punishmentId, guildId, userId, punishmentType, reason, moderatorId, timestamp) {

  const punishmentData = {
    _id: punishmentId,
    guildId: Long.fromString(guildId),
    userId: Long.fromString(userId),
    punishmentType: punishmentType,
    reason: reason,
    moderatorId: Long.fromString(moderatorId),
    timestamp: timestamp
  }
  try {
    await db.collection('punishmentData').insertOne(punishmentData);

    return false; // Return false because no existing document was found
  } catch (error) {

    throw error; // Throw the error to be handled by the caller
  }
}

async function getModLogs(userId, guildId) {
  const longGuildId = Long.fromString(guildId);
  const longUserId = Long.fromString(userId);
  return await db.collection('punishmentData').find({ guildId: longGuildId, userId: longUserId }).toArray();
}

async function deletePunishment(punishmentId) {
  try {
    await db.collection('punishmentData').deleteOne({ _id: punishmentId });
    return (true)
  }
  catch (error) {
    console.error(`Error deleting punishment ${punishmentId} from the database:`, error);
    return (false)
  }
}

async function getPunishment(punishmentId) {
  return await db.collection('punishmentData').findOne({ _id: punishmentId });
}

async function getUserXP(guildID, userID) {
  const longGuildId = Long.fromString(guildID);
  let guild = await db.collection('guildLevels').findOne({ _id: longGuildId });



  // If the user isn't in the guild's levels, add the user with 0 XP
  if (!(userID in guild.levels)) {

    await addUserXP(guildID, userID, 0);
    guild = await db.collection('guildLevels').findOne({ _id: longGuildId }); // Get the updated guild document
  }



  return guild.levels[userID];
}

async function addUserXP(guildID, userID, xpGain) {
  const longGuildId = Long.fromString(guildID);
  const guild = await db.collection('guildLevels').findOne({ _id: longGuildId });



  if (!(userID in guild.levels)) {
    // If the user isn't in the guild's levels, add the user with xpGain XP

    guild.levels[userID] = xpGain;
    await db.collection('guildLevels').updateOne({ _id: longGuildId }, { $set: { levels: guild.levels } });
  } else {
    // If the user is in the guild's levels, increase their XP by xpGain

    guild.levels[userID] += xpGain;
    await db.collection('guildLevels').updateOne({ _id: longGuildId }, { $set: { levels: guild.levels } });
  }

  const updatedGuild = await db.collection('guildLevels').findOne({ _id: longGuildId });

}

async function getGuildXpData(guildID) {
  const longGuildId = Long.fromString(guildID);
  return await db.collection('guildLevels').findOne({ _id: longGuildId });
}

async function getUserLevel(guildID, userID) {
  const userXP = await getUserXP(guildID, userID); // Fetch the user's current XP
  let level = 1; // Start checking from level 1
  let totalXP = 0; // Initialize total XP needed to reach the current checking level

  while (true) {
    let xpForNextLevel = 5 * Math.pow(level, 2) + 50 * level + 100; // XP needed to reach the next level from the current level
    totalXP += xpForNextLevel; // Add XP for the next level to the total XP
    if (userXP < totalXP) {
      // If user's XP is less than total XP needed to reach the next level, the current level is the user's level
      break;
    }
    level++; // Move to the next level
  }

  return level; // Return the determined level
}






async function getUserGuildRank(guildID, userID) {
  const longGuildId = Long.fromString(guildID);
  const guild = await db.collection('guildLevels').findOne({ _id: longGuildId });
  const sorted = Object.entries(guild.levels).sort(([, a], [, b]) => b - a);
  const rank = sorted.findIndex(([id]) => id === userID) + 1;
  return rank;
}

function getLevelXPRequirement(level) {
  let totalXP = 0; // Initialize total XP needed to reach the specified level

  for (let l = 1; l < level; l++) { // Start from level 1 up to the level just before the specified level
    totalXP += 5 * Math.pow(l, 2) + 50 * l + 100; // Sum up the XP needed for each level
  }

  return totalXP; // Return the total XP needed to reach the specified level
}

async function registerGiveaway(guildId, channelId, messageId, prize, winners, duration, timestamp) {
  const giveawayData = {
    _id: new ObjectId(),
    messageId: Long.fromString(messageId),
    guildId: Long.fromString(guildId),
    channelId: Long.fromString(channelId),
    prize: prize,
    winners: winners,
    duration: duration,
    timestamp: timestamp,
    entries: [], // Initialize entries as an empty array
  };
  try {
    await db.collection('giveawayData').insertOne(giveawayData);

    return;
  } catch (error) {

    throw error; // Throw the error to be handled by the caller
  }
}

async function enterGiveaway(userId, messageId) {
  const longUserId = Long.fromString(userId);
  // const longMessageId = Long.fromString(messageId);
  const giveaway = await db.collection('giveawayData').findOne({ _id: messageId });

  if (!giveaway) {
    return "notFound";
  }

  if (giveaway.entries.includes(longUserId)) {
    return "alreadyEntered";
  }

  giveaway.entries.push(longUserId);
  await db.collection('giveawayData').updateOne({ _id: messageId }, { $set: { entries: giveaway.entries } });

  return "entered";
}

async function getGiveawayData(messageId) {
  const longMessageId = Long.fromString(messageId);
  return await db.collection('giveawayData').findOne({ _id: longMessageId });

}

async function getAllGiveaways() {
  return await db.collection('giveawayData').find({}).toArray();
}

async function deleteGiveaway(messageId) {
  const longMessageId = Long.fromString(messageId);
  try {
    await db.collection('giveawayData').deleteOne({ _id: longMessageId });
    return (true)
  }
  catch (error) {
    console.error(`Error deleting giveaway ${messageId} from the database:`, error);
    return (false)
  }
}

async function isUserBlacklisted(userId) {
  try {
    const collection = db.collection("blacklistData");
    const query = { type: "user", userid: userId, active: true };
    const blacklistedUser = await collection.findOne(query);

    return blacklistedUser;
  } catch (err) {
    console.error("Error checking if user is blacklisted:", err);
    return null;
  }
}

async function oauthCallbackData(userEntry) {

  const collection = client.db('websiteData').collection("userData");

  // Update or insert user data in MongoDB
  await collection.updateOne(
    { "userData.id": userEntry.userData.id }, // Filter by user ID
    { $set: userEntry }, // Update or set the user data
    { upsert: true } // Create a new document if no documents match the filter
  );
}

async function fetchUserData(dataKey) {

  const collection = client.db('websiteData').collection("userData");

  const userData = await collection.findOne({ dataKey });


  if (!userData) {
    return null;
  } else {
    return userData;
  }

}

async function getBotGuilds(longGuildIds) {
  const collection = client.db('botData').collection("botSettings");

  const guilds = await collection.find({ _id: { $in: longGuildIds } }).toArray();

  return guilds;
}

async function updateGuildModuleSettings(guildId, module, enabled) {
  const collection = client.db('botData').collection('botSettings');

  // Convert guildId to a Long instance
  const longGuildId = Long.fromString(guildId);

  const currentSettings = await collection.findOne({ _id: longGuildId });

  if (currentSettings && currentSettings.modules[module] && currentSettings.modules[module].enabled === enabled) {
    return { message: 'No changes were made' };
  }

  const result = await collection.updateOne(
    { _id: longGuildId },
    { $set: { [`modules.${module}.enabled`]: enabled } },
    { upsert: true }
  );

  return { status: 'success' };
}

async function getUserAccessToGuild(guildId, dataKey) {
  const collection = client.db('websiteData').collection("userData");
  const user = await collection.findOne({ dataKey });

  if (!user) {
    return { status: 'User not found' };
  }

  const guild = user.guilds.find((guild) => guild.id === guildId);

  if (!guild) {
    return { status: 'Guild not found' };
  }

  const isOwner = guild.owner;
  const isAdmin = (guild.permissions & 0x8) === 0x8 || (guild.permissions & 0x20) === 0x20;

  let role;
  if (isOwner) {
    role = 'Owner';
  } else if (isAdmin) {
    role = 'Admin';
  } else {
    role = 'None';
  }
  return { role };
}

async function logoutUser(dataKey) {
  const collection = client.db('websiteData').collection("userData");

  const result = await collection.updateOne(
    { dataKey: dataKey }, // Filter
    { $set: { token: null, dataKey: null } } // Update
  );

  return result;
}

async function isModuleEnabled(guildId, moduleName) {
  // Get the guild settings document for the given guild ID
  const longGuildId = Long.fromString(guildId);
  const guildSettings = await db.collection('botSettings').findOne({ _id: longGuildId });

  if (!guildSettings) {
    throw new Error('Guild Settings not Found for Module Check')
  }

  // Check if the module exists in the guild settings
  if (!(moduleName in guildSettings.modules)) {
    throw new Error(`Module ${moduleName} does not exist in guild settings.`);
  }

  // Get the module settings
  const moduleSettings = guildSettings.modules[moduleName];

  // If the module settings is a boolean, return it
  // Otherwise, return the value of the "enabled" field
  return typeof moduleSettings === 'boolean' ? moduleSettings : moduleSettings.enabled;
}

async function updateServerSettings(guildId, setting, value) {
  const longGuildId = Long.fromString(guildId);
  const guildSettings = await db.collection('botSettings').findOne({ _id: longGuildId });

  if (!guildSettings) {
    throw new Error('Guild Settings not Found for Module Check')
  }

  if (setting === 'colours') {
    if (typeof value !== 'object' || !('primary' in value) || !('success' in value) || !('error' in value) || !('warning' in value) || !('special' in value)) {
      throw new Error('Invalid value for colours setting');
    }

    await db.collection('botSettings').updateOne(
      { _id: longGuildId },
      { $set: { 'serverSettings.colours': value } }
    );
  } else if (setting === 'timezone') {
    if (typeof value !== 'string') {
      throw new Error('Invalid value for timezone setting');
    }

    await db.collection('botSettings').updateOne(
      { _id: longGuildId },
      { $set: { 'serverSettings.timezone': value } }
    );
  } else {
    throw new Error('Invalid setting');
  }
}

async function getBlacklists() {
  const collection = db.collection("blacklistData");
  const blacklists = await collection.find({}).toArray();
  return blacklists;
}

async function getTicketInfo(ticketId) {
  try {
    const data = await db.collection('supportTickets').findOne({ _id: Long.fromString(ticketId) });
    return data;
  } catch {
    return null;
  }
}

async function staffOauthCallbackData(userEntry) {
  const collection = client.db('websiteData').collection("staffUserData");

  // Update or insert user data in MongoDB
  await collection.updateOne(
    { "userData.id": userEntry.userData.id }, // Filter by user ID
    { $set: userEntry }, // Update or set the user data
    { upsert: true } // Create a new document if no documents match the filter
  );
}

async function fetchStaffUserData(dataKey) {

  const collection = client.db('websiteData').collection("staffUserData");

  const userData = await collection.findOne({ dataKey });


  if (!userData) {
    return null;
  } else {
    return userData;
  }

}

async function closeDatabaseConnection() {
  if (client) {
    try {
      await client.close();
      console.log('Disconnected from MongoDB for shutdown');
    } catch (error) {
      console.error('Error disconnecting from MongoDB:', error);
      throw error;
    }
  } else {
    console.log('MongoDB client is not provided or not initialized.');
  }
}

async function saveMetricsData(data) {
  try {
    const collection = db.collection("metricsData");
    await collection.insertOne(data);
    console.log('Data successfully saved to MongoDB');
  } catch (error) {
    console.error('Error saving data to MongoDB:', error);
    throw error; // Rethrowing the error might be optional based on how you want to handle it.
  }
}



async function getGuildBotColours(guildId) {
  const longGuildId = Long.fromString(guildId);
  const guild = await db.collection('botSettings').findOne({ _id: longGuildId });
  return guild.serverSettings.colours;
}

module.exports = {
  connectToDatabase,
  getDB,
  getUserXP,
  addUserXP,
  setupServerdata,
  wipeGuildSettings,
  getGuildSettings,
  logPunishment,
  getModLogs,
  deletePunishment,
  getPunishment,
  getGuildXpData,
  getUserLevel,
  getUserGuildRank,
  getLevelXPRequirement,
  registerGiveaway,
  enterGiveaway,
  getGiveawayData,
  getAllGiveaways,
  deleteGiveaway,
  isUserBlacklisted,
  oauthCallbackData,
  fetchUserData,
  getBotGuilds,
  updateGuildModuleSettings,
  getUserAccessToGuild,
  logoutUser,
  isModuleEnabled,
  updateServerSettings,
  getTicketInfo,
  staffOauthCallbackData,
  fetchStaffUserData,
  saveMetricsData,
  closeDatabaseConnection,
  getGuildBotColours

}