const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const { DateTime } = require('luxon');

let db;

async function connectBlacklistDatabase(blacklistDBuri) {
  try {
    const client = new MongoClient(blacklistDBuri, {
      serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
      }
    });

    await client.connect();
    db = client.db('moosesassistant');
  } catch (error) {
    console.error('Failed to connect to the blacklist database', error);
    throw error; // re-throw the error if you want to handle it further up the call stack
  }
}


function getBlacklistDB() {
  return db;
}

// Functions

async function isUserBlacklisted(userId) {
  try {
    const collection = db.collection("blacklists");
    const query = { UserId: userId, Active: true };
    const blacklistedUser = await collection.findOne(query);
    return blacklistedUser;
  } catch (err) {
    console.error("Error checking if user is blacklisted:", err);
    return null;
  }
}



module.exports = {
  connectBlacklistDatabase,
  isUserBlacklisted,
  getBlacklistDB,
}
