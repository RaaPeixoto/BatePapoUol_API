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
        console.log("ok")
    })
    .catch((err) => console.log(err));


app.post("/participants", (req, res) => {
    const { name } = req.body
    const time = dayjs().format("HH:mm:ss")
    //fazer validações com a biblioteca joi// validar se campos preenchidos e se tem algum nome já no array de participantes
        participants
        .insert({
            name,
            lastStatus: Date.now(),
        })
        .then((response) => {
            //Salvar com o MongoDB uma mensagem// utilizar day js para colcoar só o horário
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
       
            res.sendStatus(201);
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
    const { to,text,type } = req.body
    const from=req.headers.user
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
    const user=req.headers.user
    if (!limit) {
        messages
        .find( {$or: [ {"to":user}, { "type":"message"}, {"type":"status"} ] })
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
    .find( {$or: [ {"to":user}, { "type":"message"}, {"type":"status"} ] })

    .toArray()
    .then((messages) => {
        res.send(messages.slice(-limit)) /* tentar usar o metodo limit */
    })
    .catch((err) =>
        res.status(500).send(err)
    )
})

app.listen(5000, () => {
    console.log(`Server running in port: ${5000}`);
});

