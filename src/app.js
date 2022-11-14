import express from 'express';
import cors from 'cors'
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import Joi from 'joi';
import dayjs from 'dayjs';

const app = express();

dotenv.config();
app.use(cors());
app.use(express.json());
const mongoClient = new MongoClient(process.env.MONGO_URI);
let db;
let participants;
let messages;


mongoClient
    .connect()
    .then(() => {
        db = mongoClient.db("batePapoUol");
        participants = db.collection("participants")
        messages = db.collection("messages")
    })
    .catch((err) => console.log(err));

async function participantValidation(req) {
    const userSchema = Joi.object({
        name: Joi.string()
            .alphanum()
            .min(3)
            .max(30)
            .required(),
    })
    const validation = userSchema.validate(req.body);
    const isValid = !validation.error

    const sameName = await participants.findOne({ name: req.body.name })

    if (!isValid) {
        return 422;

    } else if (sameName) {

        return 409;
    }

}

app.post("/participants", async (req, res) => {

    const { name } = req.body
    const time = dayjs().format("HH:mm:ss")
    //fazer validações com a biblioteca joi// validar se campos preenchidos e se tem algum nome já no array de participantes
    const error = await participantValidation(req);
    if (error) {
        return res.sendStatus(error)
    }
    try {
        await participants
            .insertOne({
                name,
                lastStatus: Date.now(),
            })

        await messages
            .insertOne({
                "from": name,
                "to": "Todos",
                "text": "entra na sala...",
                "type": "status",
                time,
            })
        res.sendStatus(201);

    } catch (err) {
        res.status(500).send(err);
    }
});

app.get("/participants", async (req, res) => {
    try {
        const allParticipants = await participants.find().toArray()
        res.send(allParticipants)

    } catch (err) {
        res.status(500).send(err)
    }
})


async function messageValidation(req, from) {
    const participant = await participants.findOne({ name: from });
    console.log(participant)
    if (!participant) {
        return 422;
    }
    const messageSchema = Joi.object({
        to: Joi.string().required(),
        text: Joi.string().required(),
        type: Joi.string().valid('message', 'private_message')
    });

    const validation = messageSchema.validate(req.body);
    const isValid = !validation.error

    if (!isValid) {
        return 422;

    }

}


app.post("/messages", async (req, res) => {
    const { to, text, type } = req.body
    const from = req.headers.user
    const time = dayjs().format("HH:mm:ss")
    //fazer validações com a biblioteca joi//
    const error = await messageValidation(req, from);
    if (error) {
        return res.sendStatus(error)
    }

    try {
        await messages
            .insertOne({
                from,
                to,
                text,
                type,
                time,
            })
        res.sendStatus(201)
    } catch (err) {
        res.status(500).send(err);
    }

});

app.get("/messages", async (req, res) => {
    const limit = parseInt(req.query.limit);
    const user = req.headers.user
    const filteredMessages = await messages
        .find({ $or: [{ "from": user }, { "to": user }, { "type": "message" }, { "type": "status" }] })
        .toArray()

    try {
        if (!limit) {
            res.send(filteredMessages)
            return
        }
        res.send(filteredMessages.slice(-limit))
    } catch (err) {
        res.status(500).send(err)
    }

})

app.post("/status", async (req, res) => {
    const user = req.headers.user
    try {
        const participant = await participants
            .findOne({ "name": user })
        
     
        if (!participant) {
            res.sendStatus(404);
            return;

        }
        participants.updateOne({ name: user }, { $set: { lastStatus: Date.now() } }).then(
            res.sendStatus(200)
        )

    } catch (err) {
        res.status(500).send(err)
    }


});

setInterval(participantsUpdate, 15000)


function participantsUpdate() {
    const now = Date.now();
    participants
        .find()
        .toArray()
        .then((p) => {
            p.forEach(element => {
                const idleTime = now - element.lastStatus

                if (idleTime > 10000) {

                    participants.deleteOne({ name: element.name })
                    messages.insertOne({
                        from: element.name,
                        to: 'Todos',
                        text: 'sai da sala...',
                        type: 'status',
                        time: dayjs().format('HH:mm:ss')
                    })

                }
            });
        })
}

app.listen(5000, () => {
    console.log(`Server running in port: ${5000}`);
});

