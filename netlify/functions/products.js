const { MongoClient, ObjectId } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI;
let db;

async function connectDB() {
  if (db) return db;
  const client = await MongoClient.connect(MONGODB_URI);
  db = client.db('candleShop');
  return db;
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const db = await connectDB();
    const collection = db.collection('products');
    const path = event.path;
    const method = event.httpMethod;
    const id = path.split('/').pop();

    if (method === 'GET') {
      const products = await collection.find().toArray();
      return { statusCode: 200, headers, body: JSON.stringify(products) };
    }

    if (method === 'POST') {
      const product = JSON.parse(event.body);
      const result = await collection.insertOne(product);
      return { statusCode: 201, headers, body: JSON.stringify(result) };
    }

    if (method === 'PUT') {
      const data = JSON.parse(event.body);
      const result = await collection.updateOne(
        { _id: new ObjectId(id) },
        { $set: data }
      );
      return { statusCode: 200, headers, body: JSON.stringify(result) };
    }

    if (method === 'DELETE') {
      const result = await collection.deleteOne({ _id: new ObjectId(id) });
      return { statusCode: 200, headers, body: JSON.stringify(result) };
    }

  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};