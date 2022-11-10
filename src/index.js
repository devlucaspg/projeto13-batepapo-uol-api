import express from 'express';
import dotenv from 'dotenv'
import cors from 'cors';
import joi from 'joi';
import dayjs from 'dayjs';
import { MongoClient } from 'mongodb';

dotenv.config();

const app = express();

const mongoClient = new MongoClient(process.env.MONGO_URL);	// { useUnifiedTopology: true }
let db

app.use(cors());
app.use(express.json());

app.listen(5000, () => {console.log('Server is running in port: 5000')});

try {
	await mongoClient.connect();
	db = mongoClient.db("projeto13-batepapo-uol-api");
} catch (err) {
	console.log(err);
	sendStatus(500);
}

app.post ('/participants', async (req, res) => {

	const { name } = req.body;

	const schema = joi.object({
		name: joi.string().min(1).required()
	});

	const validation = schema.validate(req.body);

	if (validation.error) {
		return res.sendStatus(422);
	}

	const participant = await db.collection("participants").findOne({name});

	if (participant) {
		return res.sendStatus(409);
	}

	try {
		await db.collection("participants").insert({name, lastStatus: Date.now()});
		res.sendStatus(201);
	} catch (err) {
		res.sendStatus(500);
	}
});

app.get ('/participants', async (req, res) => {
	try {
		const participants = await db.collection("participants").find().toArray();
		res.send(participants);
	} catch (err) {
		res.sendStatus(500);
	}
});

app.post ('/messages', async (req, res) => {

	const { to, text, type } = req.body;
	const from = req.headers.user;

	const schema = joi.object({
		to: joi.string().min(1).required(),
		text: joi.string().min(1).required(),
		type: joi.string().required()
	});

	schema.validate(req.body);
	
	try{
		const participant = await db.collection("participants").findOne({name: from});

		if (participant.name === from) {
			await db.collection("messages").insertOne({from, to, text, type, time: dayjs().format('HH:mm:ss')});
			return res.sendStatus(201);
		} 
	} catch (err) {
		res.sendStatus(500);
	}	
});

/* app.get ('/messages', async (req, res) => {
	try{

	} catch (err) {
		res.sendStatus(500);
	}
}); */

app.post ('/status', async (req, res) => {
	const { user } = req.headers;

	try {
		const participant = await db.collection("participants").findOne({name: user});

		if (participant.name === user) {
			await db.collection("participants").updateOne({name: user}, {$set: {lastStatus: Date.now()}});
			res.sendStatus(200);
		}
	} catch (err) {
		res.sendStatus(404);
	}
});