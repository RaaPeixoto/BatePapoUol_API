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

    const sameName = await participants.find({ name: req.body.name }).toArray()

    if (!isValid) {
        return 422;

    } else if (sameName.length !== 0) {

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

    participants
        .insert({
            name,
            lastStatus: Date.now(),
        })
        .then((response) => {
            messages
                .insertOne({
                    "from": name,
                    "to": "Todos",
                    "text": "entra na sala...",
                    "type": "status",
                    time,
                })
                .then((response) => {
                    console.log(response);
                    res.sendStatus(201);
                })
                .catch((err) => {
                    res.status(500).send(err);
                });


        })
        .catch((err) => {
            res.status(500).send(err);
        });
});

app.get("/participants", (req, res) => {
    participants
        .find()
        .toArray()
        .then((participants) => {
            res.send(participants)
        })
        .catch((err) =>
            res.status(500).send(err)
        )
})

async function messageValidation (req,from){
    const participant = await participants.findOne({ name: from});
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
    const error = await messageValidation(req,from);
    if (error) {
        return res.sendStatus(error)
    }
    messages
        .insertOne({
            from,
            to,
            text,
            type,
            time,
        })
        .then((response) => {
            console.log(response);
            res.sendStatus(201);
        })
        .catch((err) => {
            res.status(500).send(err);
        });
});

app.get("/messages", (req, res) => {
    const limit = parseInt(req.query.limit);
    const user = req.headers.user
    if (!limit) {
        messages
            .find({ $or: [{ "to": user }, { "type": "message" }, { "type": "status" }] })
            .toArray()
            .then((messages) => {
                res.send(messages)
            })
            .catch((err) =>
                res.status(500).send(err)
            )
        return

    }
    messages
        .find({ $or: [{ "from": user }, { "to": user }, { "type": "message" }, { "type": "status" }] })
        //arrumar o from
        .toArray()
        .then((messages) => {
            res.send(messages.slice(-limit))
        })
        .catch((err) =>
            res.status(500).send(err)
        )
})

app.post("/status", (req, res) => {
    const user = req.headers.user
    participants
        .find({ "name": user })
        .toArray()
        .then((p) => {
            console.log(p)
            if (p.length === 0) {
                res.sendStatus(404);
                console.log("sem")
                return;

            }

            participants.update({ name: user }, { $set: { lastStatus: Date.now() } }).then(
                res.sendStatus(200)
            )



        })
        .catch((err) =>
            res.status(500).send(err)
        )

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
                    messages.insertOne ({from: element.name,
                        to: 'Todos',
                        text: 'sai da sala...',
                        type: 'status',
                        time: dayjs().format('HH:mm:ss')})

                }
            });


        })
        
        
}

app.listen(5000, () => {
    console.log(`Server running in port: ${5000}`);
});

