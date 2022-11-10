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

async function participantValidation(req, res) {
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
        res.sendStatus(422)
        return;
    } else if (sameName.length !== 0) {
        res.sendStatus(409)
        return;
    }

}

app.post("/participants", async (req, res) => {

    const { name } = req.body

    const time = dayjs().format("HH:mm:ss")
    //fazer validações com a biblioteca joi// validar se campos preenchidos e se tem algum nome já no array de participantes
    await participantValidation(req, res)

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



app.post("/messages", (req, res) => {
    const { to, text, type } = req.body
    const from = req.headers.user
    const time = dayjs().format("HH:mm:ss")
    //fazer validações com a biblioteca joi//
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
        .find({ $or: [{ "to": user }, { "type": "message" }, { "type": "status" }] })

        .toArray()
        .then((messages) => {
            res.send(messages.slice(-limit)) /* tentar usar o metodo limit */
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

setInterval(participantsUpdate, 5000)


function participantsUpdate() {
    const now = Date.now();
    participants
        .find()
        .toArray()
        .then((p) => {
            p.forEach(element => {
                const idleTime = now - element.lastStatus
                /*  participants.delete({$unset:{lastStatus: element.lastStatus > (now+10000)}}) */
                if (idleTime > 10000) {

                    participants.deleteOne({ name: element.name })
                    console.log("taoff", idleTime)
                } else {
                    console.log("ta on", idleTime)
                }
            });


        })
        .catch(err => {
            console.log("deuruim")
        }
        )
}

app.listen(5000, () => {
    console.log(`Server running in port: ${5000}`);
});

