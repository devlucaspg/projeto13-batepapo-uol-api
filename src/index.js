import express from 'express';
import dotenv from 'dotenv'
import cors from 'cors';
import joi from 'joi';
import dayjs from 'dayjs';
import { MongoClient } from 'mongodb';

dotenv.config();

const app = express();

const sParticipants = joi.object({
	name: joi.string().min(1).required()
});

const sMessages = joi.object({
	to: joi.string().min(1).required(),
	text: joi.string().min(1).required(),
	type: joi.string().required()
});

const mongoClient = new MongoClient(process.env.MONGO_URL);	// { useUnifiedTopology: true }
let db

app.use(cors());
app.use(express.json());

try {
	await mongoClient.connect();
	console.log("MongoDB Connected");
	db = mongoClient.db("projeto13-batepapo-uol-api");
} catch (err) {
	console.log(err);
}

app.post ('/participants', async (req, res) => {

	const { name } = req.body;

	const validation = sParticipants.validate(req.body);

	if (validation.error) {
		return res.sendStatus(422);
	}

	try {
		const participant = await db.collection("participants").findOne({name});

		if (participant) {
			return res.sendStatus(409);
		}
	} catch (err) {
		console.log(err);
		return res.sendStatus(500);
	}

	try {
		await db.collection("participants").insertOne({name, lastStatus: Date.now()});
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
		console.log(err);
		res.sendStatus(500);
	}
});

app.post ('/messages', async (req, res) => {

	const { to, text, type } = req.body;
	const from = req.headers.user;

	sMessages.validate(req.body);
	
	try{
		const participant = await db.collection("participants").findOne({name: from});

		if (participant.name === from) {
			await db.collection("messages").insertOne({from, to, text, type, time: dayjs().format('HH:mm:ss')});
			return res.sendStatus(201);
		} 
	} catch (err) {
		console.log(err);
		res.sendStatus(500);
	}	
});

app.get ('/messages', async (req, res) => {
	const limit = parseInt(req.query.limit);
	const user = req.headers.user;

	try{
		const allMessages = await db.collection("messages").find().toArray();
		const messages = allMessages
			.filter((message) => message.to === user || message.from === user || message.to === "Todos" || message.type === "message")
			.slice(-limit);
		res.send(messages);
	} catch (err) {
		console.log(err);
		res.sendStatus(500);
	}
});

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

async function removeInactiveParticipants() {
	const time = Date.now() - 10000;

	try {
		const users = await db.collection("participants").find({lastStatus: {$lt: time}}).toArray();

		for (let i = 0; i < users.length; i++) {
			await db.collection("messages").insertOne({from: users[i].name, to: "Todos", text: "sai da sala...", type: "status", time: dayjs().format('HH:mm:ss')});
		}

		db.collection("participants").deleteMany({lastStatus: {$lt: time}});
	} catch (err) {
		console.log(err);
		res.sendStatus(500);
	}
}

setInterval(removeInactiveParticipants, 15000);

app.listen(process.env.PORT, () => {
	console.log(`Server is running in port: ${process.env.PORT}`)
});